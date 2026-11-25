# Spec 001 — Objetivos y aportes familiares

| Campo | Valor |
|---|---|
| **Identificador** | `001-objetivos-y-aportes` |
| **Estado** | 🟢 Aprobada |
| **Versión** | 1.2.0 |
| **Fecha** | 2026-08-31 |
| **Constitución** | v1.1.0 |
| **Fase siguiente** | Plan técnico → `plan.md` |

> Esta spec describe **qué** debe hacer el sistema y **por qué**, nunca **cómo**.
> No menciona lenguajes, frameworks, bases de datos ni bibliotecas: eso pertenece al plan.

---

## 1. Problema

En una casa, varias personas aportan dinero para cosas comunes: el recibo de la luz, una
nevera nueva, el arreglo del techo, la cuota del colegio. Hoy eso se lleva en la cabeza,
en un cuaderno o en un chat de WhatsApp, y produce tres fallas recurrentes:

1. **Nadie sabe el estado real.** ¿Cuánto falta para la nevera? ¿Quién ya puso lo suyo?
2. **No hay memoria.** Tres meses después nadie recuerda si Ana aportó en marzo.
3. **Se discute sobre cifras, no sobre acuerdos.** Sin un desglose auditable, la
   conversación se vuelve "yo sí puse" contra "yo no me acuerdo".

El sistema debe convertir esos acuerdos informales en un estado **compartido, visible y
auditable**, sin fricción de registro ni contraseñas que nadie de la familia va a recordar.

## 2. Usuarios y contexto de uso

| Perfil | Descripción | Necesidad dominante |
|---|---|---|
| **Organizador** | Quien crea el grupo y los objetivos. Suele ser quien administra la plata de la casa. | Definir cuánto le toca a cada quien y ver quién va al día. |
| **Aportante** | Miembro que pone dinero. Competencia digital variable, incluida baja. | Entrar rápido, ver cuánto debe, confirmar que su aporte quedó registrado. |
| **Observador** | Familiar que solo quiere ver el estado sin modificar nada. | Consultar sin riesgo de dañar datos. |

**Contexto real:** mayormente teléfono móvil, conexión intermitente, uso esporádico
(varias veces al mes, no diario). El sistema compite contra un cuaderno: si registrar un
aporte toma más de unos segundos, pierde.

## 3. Alcance

### 3.1 Dentro del alcance

- Grupos independientes, cada uno con sus miembros, moneda y objetivos.
- Acceso por enlace secreto, sin cuentas ni contraseñas.
- Objetivos con **monto total repartido** entre los miembros involucrados.
- Objetivos con **cuotas periódicas mensuales** hasta una fecha límite.
- Tres estrategias de reparto: partes iguales, porcentajes y montos fijos.
- Registro de aportes, incluido el caso de una persona que paga por otra.
- Anulación auditable de aportes erróneos.
- Tablero de estado por grupo, por objetivo y por miembro.
- Detección de mora en objetivos con cuotas periódicas.
- Exportación del historial completo en formato tabular.

### 3.2 Fuera del alcance (esta versión)

| Excluido | Razón |
|---|---|
| Deudas persona → persona con liquidación mínima (tipo Splitwise) | El caso real declarado es persona → objetivo. Se evalúa como spec 002. |
| Múltiples monedas dentro de un mismo grupo, con conversión | Ningún grupo familiar identificado lo necesita. |
| Autenticación, roles y permisos por usuario | Contradice el requisito explícito de "sin cuentas". |
| Notificaciones automáticas (correo, push, WhatsApp) | Requiere infraestructura y consentimiento; se evalúa después del MVP. |
| Adjuntar fotos de recibos | Añade almacenamiento de archivos. Candidato a spec 003. |
| Intereses, mora con recargo o indexación | El caso es familiar, no financiero. |
| Integración bancaria o pagos dentro de la app | El dinero se mueve fuera; la app solo lleva el registro. |

### 3.3 Supuestos

- **SUP-01.** Todos los miembros de un grupo confían entre sí. El modelo de seguridad es
  "quien tiene el enlace es de la familia", no un control de acceso real.
- **SUP-02.** Un grupo opera con **una sola moneda**, fijada al crearlo.
- **SUP-03.** El dinero se mueve por fuera del sistema (efectivo, transferencia). La app
  registra el hecho, no lo ejecuta.
- **SUP-04.** El volumen es pequeño: decenas de miembros, cientos de objetivos, miles de
  aportes por grupo. El diseño no necesita optimizarse para escala mayor.

## 4. Modelo de dominio

### 4.1 Entidades

**Grupo** — contenedor raíz y unidad de aislamiento.
`id`, `nombre`, `moneda` (código ISO + exponente decimal), `enlaceEdicion`,
`enlaceLectura`, `creadoEn`.

**Miembro** — persona que participa en un grupo. No es una cuenta de usuario.
`id`, `grupoId`, `nombre`, `activo`, `creadoEn`.

**Objetivo** — aquello para lo que se aporta ("nevera", "recibo de luz", "arreglo techo").
`id`, `grupoId`, `nombre`, `descripcion`, `montoTotal`, `modalidad`, `estado`,
`involucrados[]`, `calendario?`, `creadoEn`.

- `modalidad` ∈ { `REPARTO_UNICO`, `CUOTAS_PERIODICAS` }
- `estado` ∈ { `ACTIVO`, `CANCELADO`, `ARCHIVADO` } — **"saldado" no es un estado
  almacenado**: se deriva (Artículo IV de la constitución).
- `calendario` solo existe en `CUOTAS_PERIODICAS`: `fechaInicio`, `periodicidad: MENSUAL`,
  `fechaLimite`.

**Involucrado** — vínculo entre un objetivo y un miembro, con su regla de reparto.
`miembroId`, `tipoParte` ∈ { `IGUAL`, `PORCENTAJE`, `MONTO_FIJO` }, `valorParte`, `orden`.

**Periodo** — derivado del calendario en objetivos de cuotas. No se almacena como hecho
independiente: se calcula a partir de `fechaInicio` y `fechaLimite`.
`indice`, `fechaVencimiento`.

**Obligación** — cuánto debe un involucrado. **Derivada**, nunca almacenada.
`objetivoId`, `miembroId`, `periodoIndice?`, `montoDebido`.

**Aporte** — hecho registrado de que alguien puso dinero.
`id`, `objetivoId`, `acreditadoA` (miembroId), `pagadoPor` (miembroId), `monto`,
`fechaValor`, `periodoIndice?`, `metodo`, `nota`, `registradoPor` (texto libre),
`registradoEn`, `anulacion?`.

**Anulación** — marca inmutable sobre un aporte.
`motivo`, `anuladoPor` (texto libre), `anuladoEn`.

### 4.2 Invariantes

- **INV-01.** Toda entidad pertenece a exactamente un grupo. No hay entidades huérfanas ni
  compartidas entre grupos.
- **INV-02.** La suma de las obligaciones de todos los involucrados de un objetivo es
  **exactamente igual** a su `montoTotal`. Sin excepción por redondeo.
- **INV-03.** En `CUOTAS_PERIODICAS`, la suma de las obligaciones por periodo de un
  involucrado es exactamente igual a su obligación total en ese objetivo.
- **INV-04.** Todo monto es un entero ≥ 0 en la unidad mínima de la moneda del grupo.
- **INV-05.** Un aporte anulado no altera ningún saldo, pero permanece visible en el
  historial.
- **INV-06.** `acreditadoA` debe ser un involucrado del objetivo. `pagadoPor` debe ser un
  miembro del grupo, no necesariamente involucrado.

---

## 5. Reglas de negocio

Cada regla es verificable y tiene al menos una prueba que la nombra (Artículo VII).
Los ejemplos usan pesos colombianos (exponente decimal 0: la unidad mínima es 1 peso).

### RN-01 — Reparto por partes iguales
La parte exacta de cada involucrado es `montoTotal ÷ nºInvolucrados`. El residuo se
distribuye según **RN-04**.

> $100.000 entre Ana, Luis y Sara → parte exacta 33.333,33 → **33.334 / 33.333 / 33.333**.
> Suma exacta: $100.000.

### RN-02 — Reparto por porcentajes
Cada involucrado tiene un porcentaje expresado en **puntos básicos** (1% = 100 pb) para
evitar decimales. La suma debe ser exactamente `10.000` pb; si no, el objetivo es inválido
y no se puede guardar. La parte exacta es `montoTotal × pb ÷ 10.000`, con residuo según
**RN-04**.

> $1.000 con Ana 33,33% (3.333 pb), Luis 33,33% (3.333 pb), Sara 33,34% (3.334 pb)
> → partes truncadas 333 / 333 / 333, residuo 1 → **333 / 333 / 334**.

### RN-03 — Reparto por montos fijos
Cada involucrado tiene un monto explícito. La suma debe ser exactamente `montoTotal`; si no
coincide, el objetivo es inválido y no se puede guardar. No hay residuo.

> El sistema **no** ajusta automáticamente la diferencia: se la muestra al organizador
> ("faltan $5.000 por asignar") y él decide. Repartir en silencio sería inventar un acuerdo.

### RN-04 — Distribución determinista del residuo
Cuando un reparto produce residuo se aplica el **método del mayor resto**:

1. Cada involucrado recibe la parte entera truncada de su parte exacta.
2. El residuo (siempre menor que el nº de involucrados) se reparte de a **una unidad
   mínima**, empezando por quien tenga el mayor resto fraccionario.
3. **Desempate:** menor `orden` primero (orden de incorporación al objetivo); a igualdad de
   orden, `miembroId` ascendente.

Esta regla garantiza **INV-02** y hace el resultado reproducible: la misma entrada produce
el mismo reparto hoy y dentro de un año.

### RN-05 — Generación de periodos
En `CUOTAS_PERIODICAS` los periodos son las fechas mensuales desde `fechaInicio` hasta
`fechaLimite`, ambas incluidas. El número de periodos `N` se deriva; no se captura.

- Si `fechaLimite` es anterior a `fechaInicio`, el objetivo es inválido.
- **Desbordamiento de día:** si el día de `fechaInicio` no existe en un mes, el vencimiento
  es el último día de ese mes. Inicio el 31 de enero → vence el 28/29 de febrero, el 31 de
  marzo, el 30 de abril.

> Inicio 2026-09-05, límite 2026-12-05 → **4 periodos**: 05-sep, 05-oct, 05-nov, 05-dic.

### RN-06 — Reparto de la obligación entre periodos
La obligación total de un involucrado (RN-01/02/03) se divide entre los `N` periodos. El
residuo se distribuye con **RN-04**, desempatando por **índice de periodo ascendente**: los
periodos tempranos cargan el peso extra.

> Obligación de Ana $100.000 en 3 periodos → **33.334 / 33.333 / 33.333**.

### RN-07 — Cálculo del saldo
Todos los saldos son derivados (Artículo IV):

- `aportado` de un miembro = suma de sus aportes **no anulados** acreditados a él.
- `saldo` de un miembro = `obligación − aportado`. Positivo = debe. Negativo = a favor.
- `faltante` de un objetivo = suma de los saldos **positivos** de sus involucrados.
- `recaudado` de un objetivo = suma de todos sus aportes no anulados.

`recaudado` y `montoTotal − faltante` **pueden diferir** cuando existe saldo a favor
(RN-09). Ambas cifras se muestran; no se reconcilian en silencio.

### RN-08 — Imputación de un aporte a los periodos
En `CUOTAS_PERIODICAS`, si el aporte **no** indica periodo se imputa al **periodo pendiente
más antiguo** del miembro, y el excedente cae en cascada al siguiente periodo pendiente.

> Ana debe 33.334 / 33.333 / 33.333 y aporta $50.000 sin indicar periodo → periodo 1
> saldado (33.334), periodo 2 abonado en 16.666, periodo 3 intacto.

Si el aporte **sí** indica periodo, se imputa allí aunque genere excedente en ese periodo.
La imputación es **derivada**, no almacenada: anular un aporte anterior recalcula todo.

### RN-09 — Excedente y saldo a favor
Un aporte que supera la obligación se **acepta siempre** y produce saldo a favor del miembro
**dentro de ese objetivo**. El saldo a favor:

- se muestra de forma explícita ("Ana tiene $12.000 a favor en Nevera"),
- **no** se transfiere automáticamente a otro objetivo,
- **no** se convierte en deuda de otro miembro.

**Por qué:** mover plata entre objetivos es una decisión familiar, no una inferencia del
sistema. El sistema la señala; las personas la deciden.

### RN-10 — Objetivo saldado
Un objetivo `ACTIVO` está **saldado** cuando ningún involucrado tiene saldo positivo. Es un
estado **derivado**: nunca se escribe. Un objetivo saldado puede dejar de estarlo si se
anula un aporte o si sube el monto total, y eso es correcto.

### RN-11 — Cambio del monto total o de los involucrados
Un objetivo con aportes registrados **sí** puede modificarse. Al hacerlo:

1. Las obligaciones se recalculan desde cero con las nuevas reglas.
2. **Ningún aporte se altera, se reasigna ni se borra.**
3. Si un miembro queda con `aportado > obligación`, aparece con saldo a favor (RN-09) y el
   sistema muestra una advertencia explícita **antes** de confirmar el cambio.
4. Retirar a un involucrado que ya aportó deja su obligación en 0 y sus aportes como saldo a
   favor. Se advierte antes de confirmar; nunca ocurre en silencio.

### RN-12 — Mora
Un periodo está **en mora** si su fecha de vencimiento es anterior a la `fechaReferencia` y
su saldo pendiente es mayor que 0. Un miembro está en mora si tiene al menos un periodo en
mora.

La `fechaReferencia` **entra como parámetro** del cálculo (Artículo II): el núcleo no lee el
reloj. Esto permite responder "¿quién estaba en mora el 30 de junio?".

Los objetivos `REPARTO_UNICO` sin fecha límite **no** generan mora. Con fecha límite, el
objetivo entra en mora si esa fecha pasó y queda saldo pendiente.

### RN-13 — Anulación de aportes
Un aporte no se edita ni se borra: se **anula** con motivo obligatorio y queda visible y
tachado en el historial (Artículo V). Un aporte anulado no puede reactivarse; si la
anulación fue el error, se registra un aporte nuevo que referencia al anulado en su nota.
Corregir un monto equivale a anular el aporte errado y registrar el correcto.

### RN-14 — Baja de un miembro
Un miembro con al menos un aporte **nunca se elimina**: se marca inactivo. Un miembro
inactivo no aparece al crear objetivos nuevos, conserva íntegro su historial y sigue
apareciendo en los objetivos donde ya estaba involucrado. Un miembro sin ningún aporte sí
puede eliminarse definitivamente.

### RN-15 — Pago por cuenta de otro
Un aporte distingue **quién lo pagó** (`pagadoPor`) de **a quién se le acredita**
(`acreditadoA`). Cuando difieren, la deuda que se reduce es la de `acreditadoA`.

> Papá paga los $33.333 de Sara → el saldo de Sara baja, el de papá no cambia.
> El sistema **no** crea una deuda de Sara hacia papá: eso es una deuda persona→persona,
> explícitamente fuera de alcance (§3.2). El hecho queda registrado y visible.

### RN-16 — Cancelación, archivado y eliminación
- **CANCELADO:** el objetivo se abandonó. Deja de contar en los totales del grupo, sus
  obligaciones dejan de exigirse y sus aportes quedan como saldo a favor visible.
- **ARCHIVADO:** el objetivo se completó y sale de la vista principal. Sigue contando en los
  históricos y en la exportación.

Ninguno de los dos borra datos, y ambos son reversibles: un objetivo cancelado o archivado
puede volver a `ACTIVO`.

**Eliminación definitiva.** Un objetivo con al menos un aporte —anulado incluido— **nunca se
elimina**: se cancela o se archiva. Un objetivo sin ningún aporte sí puede eliminarse, junto
con sus involucrados, porque no hay historial que perder.

Es la misma frontera que **RN-14** traza para los miembros, y por la misma razón: lo que
protege el Artículo V es el registro de que alguien puso dinero. Un objetivo que nadie tocó
—creado por error, con el nombre mal escrito, duplicado— no es historial, es ruido, y
obligar a conservarlo para siempre haría que la lista de objetivos dejara de ser fiable.

### RN-19 — Eliminación de un grupo completo
Quien tiene el enlace de edición puede **borrar el grupo entero**: sus miembros, sus objetivos
y todos sus aportes, anulados incluidos. Es la única operación del sistema que destruye
historial, y por eso:

- Alcanza **solo al grupo del enlace presentado**. Nunca a otro grupo (INV-01, Artículo VI).
- Exige una confirmación que no se pueda dar por accidente: hay que **escribir el nombre
  exacto del grupo**. Un botón con "¿estás seguro?" se acepta sin leer.
- Es **irreversible y sin respaldo**. La interfaz lo dice con esas palabras antes de pedir la
  confirmación, y ofrece exportar primero cuando la exportación exista (RF-18).

**Por qué esto no contradice el Artículo V.** Lo que ese artículo prohíbe es que un dato
desaparezca *en silencio* o *a medias* mientras el grupo sigue vivo: que alguien borre un
aporte y el saldo cambie sin dejar rastro. Aquí no queda ningún saldo que explicar, porque no
queda grupo. Es lo contrario de encerrar los datos de la familia (RNF-09): quien los puso
puede llevárselos y puede borrarlos.

### RN-17 — Aislamiento y acceso por enlace
- Cada grupo tiene un **enlace de edición** y un **enlace de solo lectura**, ambos con un
  secreto de al menos 128 bits de entropía.
- Toda operación exige presentar un enlace válido del grupo objetivo. Un enlace **nunca** da
  acceso a otro grupo (INV-01).
- El enlace de solo lectura permite ver todo y modificar nada.
- Cualquiera de los dos puede **rotarse**; el anterior queda inválido de inmediato.
- La atribución (`registradoPor`) es un nombre auto-declarado. **No es autenticación**, y la
  interfaz debe decirlo: sirve para recordar, no para probar.

### RN-18 — Escrituras concurrentes
Los aportes solo se añaden: dos personas registrando a la vez **no** compiten y ambos
aportes se conservan. Al editar la definición de un mismo objetivo en paralelo, la segunda
escritura debe detectar el conflicto y pedir recargar, en vez de pisar el cambio ajeno.

---

## 6. Historias de usuario

### HU-01 — Crear un grupo y compartirlo
> Como organizador quiero crear un grupo y mandar un enlace por WhatsApp, para que la
> familia vea el estado sin instalar nada ni crear cuentas.

- **Dado** que no tengo grupo, **cuando** indico nombre y moneda, **entonces** se crea el
  grupo y obtengo dos enlaces distintos: edición y solo lectura.
- **Dado** un enlace de solo lectura, **cuando** intento registrar un aporte, **entonces**
  la acción se rechaza y la interfaz explica que ese enlace es de consulta.
- **Dado** que roto el enlace de edición, **cuando** alguien abre el enlace anterior,
  **entonces** obtiene un mensaje de enlace inválido y ningún dato del grupo.

### HU-02 — Gestionar los miembros
> Como organizador quiero registrar quiénes somos, para poder repartir entre nosotros.

- **Dado** un grupo, **cuando** agrego un miembro con su nombre, **entonces** queda activo y
  disponible para involucrarlo en objetivos.
- **Dado** un miembro con aportes, **cuando** intento eliminarlo, **entonces** el sistema lo
  impide y ofrece marcarlo inactivo (RN-14).
- **Dado** un miembro sin aportes, **cuando** lo elimino, **entonces** desaparece del grupo.

### HU-03 — Objetivo de monto total repartido
> Como organizador quiero decir "la nevera cuesta $1.200.000 y la pagamos entre estos
> cuatro", para que cada uno sepa cuánto le toca.

- **Dado** un monto total y cuatro involucrados en partes iguales, **cuando** guardo,
  **entonces** cada uno tiene su obligación y la suma es exactamente el total (INV-02).
- **Dado** un reparto por montos fijos cuya suma no es el total, **cuando** intento guardar,
  **entonces** se rechaza indicando cuánto falta o sobra (RN-03).
- **Dado** un reparto por porcentajes que no suma 100%, **cuando** intento guardar,
  **entonces** se rechaza indicando la diferencia (RN-02).

### HU-04 — Objetivo de cuotas mensuales hasta una fecha
> Como organizador quiero decir "entre los tres juntamos $900.000 para el techo, de aquí a
> diciembre", para que cada mes se sepa qué toca poner.

- **Dado** un total, una fecha de inicio y una fecha límite mensual, **cuando** guardo,
  **entonces** se generan los periodos correspondientes y cada involucrado ve su cuota por
  periodo (RN-05, RN-06).
- **Dado** un objetivo con periodos vencidos e impagos, **cuando** consulto en una fecha
  posterior, **entonces** esos periodos y sus miembros aparecen en mora (RN-12).
- **Dado** una fecha límite anterior a la de inicio, **cuando** intento guardar,
  **entonces** se rechaza.

### HU-05 — Registrar un aporte
> Como aportante quiero registrar en segundos que puse mi parte, para no tener que avisar
> por chat ni que me lo pregunten después.

- **Dado** un objetivo activo, **cuando** registro monto, fecha y a quién se acredita,
  **entonces** el saldo de esa persona baja de inmediato y el aporte queda en el historial.
- **Dado** un objetivo de cuotas, **cuando** aporto sin indicar periodo, **entonces** se
  imputa al periodo pendiente más antiguo y el excedente cae en cascada (RN-08).
- **Dado** que pago la cuota de otro, **cuando** indico quién pagó y a quién se acredita,
  **entonces** baja el saldo de quien se acredita, no el del pagador (RN-15).
- **Dado** un aporte mayor a lo que debo, **cuando** lo registro, **entonces** se acepta y
  aparece como saldo a favor en ese objetivo (RN-09).

### HU-06 — Ver el estado de un vistazo
> Como cualquier miembro quiero abrir el enlace y entender en cinco segundos cómo vamos,
> sin tener que interpretar una tabla.

- **Dado** un grupo con objetivos activos, **cuando** abro el enlace, **entonces** veo por
  objetivo cuánto se necesita, cuánto se ha recaudado y cuánto falta.
- **Dado** que me identifico como un miembro, **cuando** veo el tablero, **entonces** veo
  primero **lo mío**: cuánto debo en total y en qué objetivos.
- **Dado** un objetivo saldado, **cuando** lo veo, **entonces** está marcado como saldado sin
  que nadie haya tenido que cambiarle el estado a mano (RN-10).
- **Dado** cualquier cifra mostrada, **cuando** la abro, **entonces** veo el desglose de los
  aportes que la producen (Artículo V).

### HU-07 — Corregir un error
> Como organizador quiero arreglar un aporte mal registrado sin que quede la duda de si
> alguien borró algo a escondidas.

- **Dado** un aporte errado, **cuando** lo anulo indicando el motivo, **entonces** deja de
  contar en los saldos pero sigue visible como anulado, con motivo, autor y fecha (RN-13).
- **Dado** un aporte anulado, **cuando** intento anularlo otra vez o reactivarlo,
  **entonces** la acción se rechaza.

### HU-08 — Cambiar un objetivo ya en marcha
> Como organizador quiero ajustar el monto cuando la nevera resultó más cara, sin perder
> los aportes que ya se hicieron.

- **Dado** un objetivo con aportes, **cuando** cambio el monto total, **entonces** las
  obligaciones se recalculan y ningún aporte se altera (RN-11).
- **Dado** un cambio que dejaría a alguien con saldo a favor, **cuando** voy a confirmarlo,
  **entonces** el sistema me advierte con nombre y monto antes de aplicarlo.
- **Dado** un objetivo que se abandonó, **cuando** lo cancelo, **entonces** deja de contar en
  los totales del grupo y sus aportes quedan visibles como saldo a favor (RN-16).
- **Dado** un objetivo creado por error y sin ningún aporte, **cuando** lo elimino,
  **entonces** desaparece del grupo (RN-16).
- **Dado** un objetivo con aportes, **cuando** intento eliminarlo, **entonces** el sistema lo
  impide y ofrece cancelarlo o archivarlo (RN-16, Artículo V).
- **Dado** que alguien más cambió el mismo objetivo mientras yo lo editaba, **cuando** guardo,
  **entonces** se me avisa del conflicto y se me pide recargar, en vez de pisar su cambio
  (RN-18).

### HU-09 — Exportar el historial
> Como organizador quiero bajar todo a un archivo, para no depender de que la app exista
> dentro de dos años.

- **Dado** un grupo, **cuando** exporto, **entonces** obtengo un archivo tabular con todos
  los objetivos, obligaciones y aportes, incluidos los anulados y los archivados.
- **Dado** el archivo exportado, **cuando** lo abro en una hoja de cálculo, **entonces** los
  montos son numéricos y las fechas legibles, sin necesidad de procesarlos.

> Como organizador quiero poder borrar el grupo entero cuando ya no lo necesitamos, para que
> nuestros datos no se queden ahí para siempre.

- **Dado** un grupo, **cuando** pido eliminarlo y escribo su nombre exacto, **entonces**
  desaparecen sus miembros, objetivos y aportes, y el enlace deja de funcionar (RN-19).
- **Dado** que escribo mal el nombre, **cuando** confirmo, **entonces** no se borra nada.
- **Dado** el enlace de solo lectura, **cuando** intento eliminar el grupo, **entonces** se
  rechaza.

---

## 7. Requisitos funcionales

| ID | Requisito | Reglas | Historia |
|---|---|---|---|
| **RF-01** | Crear un grupo con nombre y moneda, generando enlace de edición y de solo lectura. | RN-17 | HU-01 |
| **RF-02** | Acceder a un grupo mediante enlace, con permisos según el tipo de enlace. | RN-17 | HU-01 |
| **RF-03** | Rotar cualquiera de los dos enlaces, invalidando el anterior. | RN-17 | HU-01 |
| **RF-04** | Alta, edición, desactivación y eliminación condicionada de miembros. | RN-14 | HU-02 |
| **RF-05** | Crear un objetivo `REPARTO_UNICO` con involucrados y estrategia de reparto. | RN-01–04 | HU-03 |
| **RF-06** | Crear un objetivo `CUOTAS_PERIODICAS` con inicio, límite y periodicidad mensual. | RN-05, RN-06 | HU-04 |
| **RF-07** | Validar el reparto antes de guardar y explicar la diferencia si no cuadra. | RN-02, RN-03 | HU-03 |
| **RF-08** | Calcular las obligaciones de cada involucrado, por objetivo y por periodo. | RN-01–06 | HU-03, HU-04 |
| **RF-09** | Registrar un aporte con monto, fecha, acreditado, pagador, método y nota. | RN-08, RN-15 | HU-05 |
| **RF-10** | Imputar automáticamente los aportes a los periodos pendientes. | RN-08 | HU-05 |
| **RF-11** | Aceptar excedentes y reportarlos como saldo a favor. | RN-09 | HU-05 |
| **RF-12** | Anular un aporte con motivo obligatorio, conservándolo en el historial. | RN-13 | HU-07 |
| **RF-13** | Calcular saldos por miembro, por objetivo y por grupo a una fecha dada. | RN-07 | HU-06 |
| **RF-14** | Marcar objetivos saldados y periodos/miembros en mora. | RN-10, RN-12 | HU-04, HU-06 |
| **RF-15** | Desglosar cualquier cifra hasta los aportes que la componen. | Art. V | HU-06 |
| **RF-16** | Modificar monto, involucrados o reparto de un objetivo con aportes, avisando. | RN-11 | HU-08 |
| **RF-17** | Cancelar, archivar y reactivar objetivos. | RN-16 | HU-08 |
| **RF-18** | Exportar todo el grupo en formato tabular. | Art. V | HU-09 |
| **RF-19** | Detectar edición concurrente de un objetivo y pedir recargar. | RN-18 | — |
| **RF-20** | Operar varios grupos independientes sin filtración de datos entre ellos. | INV-01 | — |
| **RF-21** | Permitir que quien abre el enlace se identifique como un miembro y recordarlo en ese dispositivo, para mostrarle primero lo suyo. No es autenticación. | RN-17 | HU-06 |
| **RF-22** | Eliminar definitivamente un objetivo que no tenga ningún aporte, impidiéndolo cuando sí los tiene. | RN-16 | HU-08 |
| **RF-23** | Eliminar un grupo entero con todos sus datos, exigiendo escribir su nombre exacto como confirmación. | RN-19 | HU-09 |

## 8. Requisitos no funcionales

| ID | Requisito | Criterio verificable |
|---|---|---|
| **RNF-01** | Exactitud monetaria | Ningún monto se representa en coma flotante. Toda suma de partes iguala el total al peso. Se prueba con repartos que producen residuo. |
| **RNF-02** | Núcleo reutilizable | La lógica de reparto, obligaciones, imputación y saldos no importa nada de red, almacenamiento, reloj ni interfaz. Verificable por dependencias del módulo. |
| **RNF-03** | Registro sin fricción | Registrar un aporte desde el tablero toma como máximo 3 interacciones y menos de 20 segundos en móvil. |
| **RNF-04** | Rendimiento | El estado completo de un grupo con 20 miembros, 100 objetivos y 2.000 aportes se calcula en menos de 100 ms en un móvil de gama media. |
| **RNF-05** | Tolerancia a mala conexión | La consulta funciona con datos ya cargados aunque la red falle. El comportamiento de escritura sin red se define en el plan. |
| **RNF-06** | Secreto del enlace | Mínimo 128 bits de entropía criptográfica. No aparece en registros de servidor, no se envía en cabeceras de referencia, y las páginas de grupo no se indexan. |
| **RNF-07** | Idioma y formato | Interfaz en español. Montos con separadores locales y sin decimales cuando la moneda tiene exponente 0. |
| **RNF-08** | Accesibilidad | Contraste AA, objetivos táctiles de al menos 44 px, legible con el tamaño de texto del sistema aumentado. |
| **RNF-09** | Sin encierro de datos | Toda la información de un grupo es exportable en un formato abierto y legible sin la aplicación. |
| **RNF-10** | Trazabilidad | Cada `RN-xx` tiene al menos una prueba automatizada cuyo nombre la referencia. |

## 9. Casos borde

| ID | Situación | Comportamiento esperado |
|---|---|---|
| **CB-01** | Objetivo con un solo involucrado | Válido. Su obligación es el total, sin residuo. |
| **CB-02** | Objetivo sin involucrados | Inválido. No se puede guardar. |
| **CB-03** | Monto total igual a 0 o negativo | Inválido. |
| **CB-04** | Aporte de monto 0 o negativo | Inválido. Para revertir se usa la anulación (RN-13), no un aporte negativo. |
| **CB-05** | Aporte con fecha anterior a la creación del objetivo | Válido: el registro es retroactivo por naturaleza. |
| **CB-06** | Aporte con fecha futura | Válido, pero se muestra marcado como futuro y no cuenta para la mora a la fecha actual. |
| **CB-07** | El monto total se reduce por debajo de lo ya aportado | Permitido con advertencia. Todos los involucrados quedan con saldo a favor (RN-11). |
| **CB-08** | Dos miembros con el mismo nombre | Permitido; se distinguen internamente. La interfaz advierte del nombre repetido al crearlo. |
| **CB-09** | Objetivo de cuotas donde inicio y límite son el mismo mes | Válido: un solo periodo, equivalente a un reparto único con fecha límite. |
| **CB-10** | Todos los aportes de un objetivo quedan anulados | El objetivo vuelve a recaudado 0 y deja de estar saldado (RN-10). |
| **CB-11** | Grupo sin miembros | No se pueden crear objetivos. La interfaz guía primero a agregar miembros. |
| **CB-12** | Miembro inactivo con obligación pendiente | Sigue debiendo y sigue visible en el objetivo. Desactivar no perdona deudas. |
| **CB-13** | Anular un aporte de un objetivo archivado | Permitido, con advertencia de que altera un histórico ya cerrado. |
| **CB-14** | Moneda con exponente 2 (p. ej. USD) | La unidad mínima es el centavo. Todas las reglas de reparto operan igual sobre esa unidad. |
| **CB-15** | Reparto por porcentajes donde alguien queda en 0 pb | Válido: participa del objetivo sin obligación económica. |
| **CB-16** | Eliminar un objetivo que solo tiene aportes anulados | Inválido. Un aporte anulado sigue siendo historial (Artículo V): se cancela o se archiva. |
| **CB-17** | Editar un objetivo dejándolo con un solo involucrado | Válido, como CB-01. Los demás quedan con saldo a favor si ya aportaron, y se advierte antes de confirmar. |
| **CB-18** | Eliminar un grupo escribiendo mal su nombre | No se borra nada. El sistema lo dice y deja volver a intentarlo. |
| **CB-19** | Eliminar un grupo con dos enlaces vigentes | Ambos dejan de funcionar de inmediato: no queda grupo al que resolver. |

## 10. Decisiones de clarificación

Todas las preguntas abiertas quedaron cerradas antes de aprobar esta spec.

| ID | Pregunta | Decisión | Consecuencia |
|---|---|---|---|
| **PA-01** | ¿Periodicidad distinta de la mensual? | **Solo mensual.** | El modelo guarda `periodicidad` como campo para no cerrar la puerta, pero solo acepta `MENSUAL`. Añadir quincenal después no rompe datos existentes. |
| **PA-02** | ¿El saldo a favor se traslada entre objetivos? | **No.** | RN-09 se mantiene: se señala, no se mueve. Candidato a spec 002 si el uso real lo pide. |
| **PA-03** | ¿La app pregunta "¿quién eres?" al abrir el enlace? | **Sí.** | Nace **RF-21**. Se guarda en el dispositivo, no en el servidor, y se puede cambiar en cualquier momento. No es autenticación y la interfaz debe decirlo. |
| **PA-04** | ¿Qué pasa con un grupo abandonado? | **Se conserva sin caducidad.** | Se revisa solo si aparece un costo de almacenamiento real. |
| **PA-05** | ¿Quién puede rotar los enlaces? | **Cualquiera con el enlace de edición.** | Coherente con SUP-01. La interfaz advierte que deja fuera a todos los demás. |
| **PA-06** | ¿Corte de cuentas mensual del grupo? | **No en esta versión.** | Los objetivos de cuotas ya dan la granularidad mensual necesaria. |

## 11. Criterios de éxito

La versión se considera lograda si, en uso real con una familia:

1. **Reemplaza el cuaderno.** Tras un mes, todos los aportes del grupo están en el sistema y
   ninguno solo en el chat o en papel.
2. **Contesta sin ayuda.** Un miembro que no creó el grupo responde "¿cuánto debo?" abriendo
   el enlace, sin preguntarle a nadie.
3. **Aguanta la discusión.** Ante una diferencia, el desglose de la cifra alcanza para
   cerrar la conversación sin recurrir a la memoria de nadie.
4. **Cuadra siempre.** Ninguna vista muestra una suma de partes distinta del total.
5. **Se reutiliza.** El mismo despliegue sirve a un segundo grupo con otra composición y otro
   propósito, sin tocar código ni configuración.

## 12. Glosario

| Término | Significado en este proyecto |
|---|---|
| **Grupo** | Conjunto de personas que comparten objetivos y un enlace. Unidad de aislamiento. |
| **Miembro** | Persona dentro de un grupo. No es una cuenta ni un usuario autenticado. |
| **Objetivo** | Aquello para lo que se aporta dinero. Tiene un monto total y unos involucrados. |
| **Involucrado** | Miembro al que le corresponde una parte de un objetivo. |
| **Obligación** | Cuánto le corresponde poner a un involucrado. Siempre calculada, nunca guardada. |
| **Aporte** | Hecho registrado de que alguien entregó dinero para un objetivo. |
| **Saldo** | Obligación menos aportado. Positivo es deuda; negativo es saldo a favor. |
| **Periodo** | Cada mes de un objetivo de cuotas, con su fecha de vencimiento. |
| **Mora** | Periodo vencido con saldo pendiente a una fecha de referencia dada. |
| **Anulación** | Marca que deja un aporte sin efecto sin borrarlo del historial. |
| **Unidad mínima** | La menor unidad indivisible de la moneda del grupo (1 peso en COP, 1 centavo en USD). |

## 13. Trazabilidad

`Constitución` → `spec.md` (RN/RF/RNF) → `plan.md` (decisiones técnicas) → `tasks.md`
(tareas) → pruebas → commits.

- Todo `RF-xx` nace de al menos una `HU-xx`.
- Todo `RN-xx` tiene al menos una prueba que lo nombra (Artículo VII, RNF-10).
- Ningún archivo de implementación existe sin una tarea que lo cree, y ninguna tarea existe
  sin un requisito que la motive (Artículo I).

## 14. Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 1.2.0 | 2026-09-04 | Nace **RN-19** y **RF-23**: se puede borrar un grupo entero, con confirmación escrita. HU-09 gana la historia. Nuevos CB-18 y CB-19. |
| 1.1.0 | 2026-09-04 | Nace **RF-22** y RN-16 gana la frontera de la eliminación, con la misma regla que RN-14 usa para los miembros. RF-17 incluye reactivar. Nuevos CB-16 y CB-17. Motivado por la petición de poder borrar y editar objetivos desde la interfaz. |
| 1.0.0 | 2026-08-31 | **Aprobada.** Se cierran PA-01 a PA-06 y nace RF-21. Se adopta la constitución v1.1.0 (entrega incremental). |
| 0.1.0 | 2026-08-31 | Borrador inicial a partir de la sesión de clarificación. |
