# Plan técnico — Spec 001

| Campo | Valor |
|---|---|
| **Spec** | `001-objetivos-y-aportes` v1.0.0 (aprobada) |
| **Constitución** | v1.1.0 |
| **Estado** | 🟢 Aprobado |
| **Fecha** | 2026-08-31 |

> El plan responde **cómo**. Todo lo que aparece aquí se rastrea a un requisito de la spec.
> Lo que no se pueda justificar contra un `RF-xx` o `RNF-xx`, sobra (Artículo VIII).

---

## 1. Revisión constitucional

| Artículo | Cómo lo cumple este plan |
|---|---|
| **I** — La spec manda | Cada decisión `DT-xx` cita los requisitos que la exigen. Las tareas citan `RF-xx`. |
| **II** — Núcleo puro | `packages/core` sin dependencias de runtime. `fechaReferencia` e `id` entran como parámetros; el núcleo no llama al reloj ni genera identificadores. Se verifica con una prueba que falla si aparece cualquier `import` externo. |
| **III** — Dinero entero | Tipo marcado `Minor` sobre entero seguro (DT-04). Prohibido el operador `/` sobre montos fuera del módulo de reparto. |
| **IV** — Saldos derivados | El esquema SQL **no tiene** columnas de saldo, obligación ni "pagado". Se calculan al vuelo (DT-05, §4). |
| **V** — Historial inmutable | `aporte` es append-only; la anulación es una marca, nunca un `DELETE`. Sin `UPDATE` sobre montos ni fechas de aportes. |
| **VI** — Multi-grupo | `grupo_id` en toda tabla y en toda consulta; el acceso se resuelve en un único punto de entrada (DT-09). Prueba explícita de aislamiento. |
| **VII** — Pruebas como contrato | Cada `RN-xx` tiene prueba que lo nombra en el título (§6). |
| **VIII** — Simplicidad | Cinco dependencias de producción en total. SQLite en archivo, un solo proceso, sin ORM, sin Docker Compose, sin cola. |
| **IX** — Entrega incremental | Cinco incrementos verticales, cada uno usable de punta a punta (ver `tasks.md`). |
| **X** — Recortar alcance, no corrección | Los incrementos posponen funcionalidad; ninguno pospone exactitud monetaria ni auditabilidad. |

**Excepciones solicitadas:** ninguna.

---

## 2. Decisiones técnicas

### DT-01 — TypeScript en todo el proyecto
- **Exigido por:** RNF-02 (núcleo reutilizable), RNF-01 (exactitud).
- **Alternativas:** Python + HTMX (descartada: el núcleo no se reusaría desde el navegador y
  RNF-04 obligaría a ida y vuelta al servidor para cada cifra); Kotlin/JVM (descartada:
  desproporcionado para el tamaño real del problema).
- **Consecuencias:** el mismo núcleo corre en el servidor, en el navegador y en pruebas.
  Facilita mucho RNF-05: el cliente puede recalcular saldos sin red.
- **Reversibilidad:** alta para la interfaz, baja para el núcleo. Es la decisión más cara de
  revertir, y por eso el núcleo es la parte con menos dependencias.

### DT-02 — Monorepo con `npm workspaces`
- **Exigido por:** RNF-02, Artículo II.
- **Alternativas:** pnpm/turborepo (descartadas: instalar herramienta adicional para tres
  paquetes contradice el Artículo VIII); repositorios separados (descartada: sincronizar el
  núcleo entre repos es fricción pura en un proyecto de una persona).
- **Consecuencias:** `npm` 11 ya está instalado; cero herramienta nueva.

### DT-03 — El núcleo no tiene dependencias de runtime
`packages/core` declara `"dependencies": {}`. Sin fechas, sin validación, sin utilidades.

- **Exigido por:** Artículo II, RNF-02.
- **Consecuencias:** hay que escribir a mano la aritmética de calendario de RN-05
  (desbordamiento de día de mes). Es ~40 líneas y se prueba exhaustivamente; a cambio, el
  núcleo es auditable de un vistazo y no envejece con sus dependencias.

### DT-04 — El dinero es `number` entero seguro, con tipo marcado
```ts
type Minor = number & { readonly __brand: 'Minor' };  // unidad mínima de la moneda
```
- **Exigido por:** Artículo III, RNF-01.
- **Alternativas:** `bigint` (descartada: no serializa a JSON sin conversión manual en cada
  frontera, y el rango real —millones de pesos— cabe de sobra en el entero seguro);
  `decimal.js` (descartada: introduce dependencia y decimales donde la spec pide enteros).
- **Salvaguardas:** un constructor `minor()` valida `Number.isSafeInteger` y rechaza lo
  demás. Regla de ESLint que prohíbe `/` y `*` sobre valores `Minor` fuera de
  `core/src/reparto.ts`, que es el único lugar autorizado a dividir dinero.
- **Riesgo aceptado:** COP hasta ~9.007 billones. Un grupo familiar no se acerca.

### DT-05 — SQLite en archivo, vía el módulo `node:sqlite` incorporado
- **Exigido por:** RN-17 (estado compartido), RNF-04, Artículo VIII.
- **Alternativas:** Postgres gestionado (descartada: costo e infraestructura para un grupo
  familiar); Supabase/PocketBase (descartadas: arrastran un modelo de auth que la spec
  rechaza explícitamente); `better-sqlite3` (buena, pero es módulo nativo y en Windows añade
  fricción de compilación).
- **Consecuencias:** cero dependencias de base de datos, respaldo = copiar un archivo, y eso
  cubre RNF-09 casi gratis. Sin ORM: SQL escrito a mano, que para cinco tablas es más claro.
- **Riesgo:** `node:sqlite` es API experimental en Node 24 (ver RG-01).

### DT-06 — API HTTP con **Hono**
- **Exigido por:** RN-17, RF-02, RF-19.
- **Alternativas:** Express (descartada: más peso y tipado más pobre); Fastify (buena, pero
  más superficie de la necesaria); `node:http` a pelo (descartada: el enrutamiento y la
  validación escritos a mano cuestan más de lo que ahorran).
- **Consecuencias:** una sola dependencia, tipado bueno, y sirve también los estáticos de la
  web: **un solo proceso y un solo despliegue**.

### DT-07 — Web con React + Vite, empaquetada como PWA
- **Exigido por:** RNF-03 (móvil), RNF-05 (mala conexión), RNF-08 (accesibilidad), RF-21.
- **Alternativas:** Next.js (descartada: SSR y su infraestructura no aportan nada aquí y
  contradicen el Artículo VIII); HTML+JS sin framework (descartada: el tablero de HU-06 tiene
  suficiente estado derivado como para que valga un framework).
- **Consecuencias:** instalable en el teléfono desde el enlace, sin tienda de aplicaciones.

### DT-08 — Caché de cliente con TanStack Query
- **Exigido por:** RNF-05.
- **Justificación:** la consulta debe seguir funcionando con la red caída. Query da caché,
  revalidación y estados de carga sin escribirlos a mano. **Solo lectura offline**: la
  escritura sin red se muestra como error explícito, no se encola (ver §8).

### DT-09 — Enlaces: 160 bits de secreto, guardados como hash
El enlace es `/g/<token>`; `token` = 20 bytes aleatorios en base64url (27 caracteres).
En la base de datos **no se guarda el token**, sino su `SHA-256`.

- **Exigido por:** RN-17, RNF-06.
- **Por qué el hash:** si alguien se lleva el archivo `.db`, no obtiene enlaces utilizables.
  Es el mismo razonamiento que con una contraseña, y aquí cuesta tres líneas.
- **Consecuencias:** el token se muestra **una sola vez** al crear el grupo o al rotarlo, y
  la interfaz debe advertirlo. No hay "recuperar mi enlace".
- **Además:** `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, y el token nunca entra
  en los registros del servidor (se enmascara antes de registrar cualquier petición).

### DT-10 — Concurrencia por versión optimista
Cada objetivo tiene `version INTEGER`. Toda edición envía la versión que leyó; si no coincide,
la API responde `409` y la interfaz pide recargar.

- **Exigido por:** RF-19, RN-18.
- **Los aportes no llevan versión:** solo se añaden, así que no compiten (RN-18).

### DT-11 — Las fechas civiles son cadenas `AAAA-MM-DD` por dentro y `DD-MM-AAAA` a la vista
Vencimientos, fechas de valor y fecha de referencia son cadenas, nunca `Date`.

- **Exigido por:** RN-05, RN-12, RNF-03, Artículo II.
- **Por qué cadenas y no `Date`:** "el 5 de diciembre" no tiene hora ni zona horaria. Usar
  `Date` invita a que un vencimiento se corra un día según el huso del teléfono, y eso
  convierte en moroso a quien no lo es. Solo `registradoEn` y `anuladoEn` son marcas de
  tiempo reales, en UTC.
- **Por qué `AAAA-MM-DD` dentro:** el orden lexicográfico coincide con el cronológico, así
  que `ORDER BY fecha_limite`, los rangos en SQL y las comparaciones del núcleo funcionan
  sobre la cadena, sin convertir. RN-05 y RN-12 dependen de eso.
- **Por qué `DD-MM-AAAA` fuera:** es como se escribe y se lee una fecha en casa. Un
  vencimiento en formato ISO se lee mal de un vistazo en el teléfono, y RNF-03 pide
  justamente que se entienda de un vistazo.

**Dónde vive la conversión.** Solo en `apps/web`, en el borde de presentación y captura:

```ts
// core y api hablan AAAA-MM-DD SIEMPRE. web traduce en la entrada y en la salida.
function aVista(f: FechaCivil): string;         // '2026-12-05' -> '05-12-2026'
function deVista(s: string): FechaCivil | null; // '05-12-2026' -> '2026-12-05'; null si no es válida
```

- El núcleo **no conoce** `DD-MM-AAAA`: sigue recibiendo y devolviendo `FechaCivil` en ISO.
  Meter dos formatos en `core` sería exactamente el tipo de ambigüedad que el Artículo II
  quiere fuera.
- La API tampoco: el JSON viaja en ISO. Si mañana hay otra interfaz, no hereda el formato de
  esta.
- La captura usa `<input type="date">`, que ya muestra la fecha según la configuración del
  teléfono y entrega ISO. `deVista` cubre el caso de escritura manual y el respaldo cuando
  ese control no está disponible.
- **Prueba:** ida y vuelta (`deVista(aVista(f)) === f`) sobre fechas generadas al azar, y un
  caso que confirma que ninguna fuente de `core` ni de `api` contiene `DD-MM-AAAA`.

### DT-12 — Los identificadores se generan fuera del núcleo
`crypto.randomUUID()` en el adaptador; el núcleo los recibe como parámetro.
- **Exigido por:** Artículo II (determinismo).

### DT-13 — Vitest, con pruebas basadas en propiedades para los invariantes
`fast-check` para INV-02 e INV-03: para cualquier total y cualquier reparto generado al azar,
**la suma de las partes es igual al total**.
- **Exigido por:** RNF-01, RNF-10, Artículo VII.
- **Por qué:** los errores de residuo aparecen en combinaciones que nadie escribe a mano.

### DT-14 — Despliegue: un contenedor, un volumen
Un proceso Node sirve API y estáticos; el `.db` vive en un volumen persistente. Respaldo =
copia del archivo. Destino concreto (Fly.io, Railway o VPS) se decide en el Incremento 1;
ninguna decisión del plan depende de cuál sea.

---

## 3. Arquitectura

Las dependencias apuntan **siempre hacia adentro**. El núcleo no sabe que existe el resto.

```
      apps/web  ─────┐                    ┌───── apps/api
   React + Vite      │                    │   Hono + node:sqlite
   (RF-21, HU-06)    ▼                    ▼   (RN-17, RF-19)
                  ┌─────────────────────────┐
                  │     packages/core       │
                  │  reparto · calendario   │
                  │  imputación · saldos    │
                  │  validación · tipos     │
                  │   CERO dependencias     │
                  └─────────────────────────┘
```

- **`packages/core`** — todo `RN-xx`. Funciones puras sobre estructuras planas. No importa
  nada que no sea TypeScript. Corre igual en Node, en el navegador y en Vitest.
- **`apps/api`** — traduce HTTP y SQL a estructuras del núcleo y de vuelta. Aquí viven el
  reloj, los identificadores, la aleatoriedad y la autorización por enlace.
- **`apps/web`** — presenta y captura. Puede importar el núcleo para recalcular saldos sin
  ida y vuelta al servidor, lo que sostiene RNF-04 y RNF-05.

**Prueba que protege el límite:** un test lee el `package.json` de `core` y falla si
`dependencies` no está vacío, y otro recorre sus fuentes y falla ante cualquier `import`
que no sea relativo. El Artículo II deja de depender de la disciplina.

## 4. Modelo de datos

**Hechos almacenados** — cinco tablas, ninguna con saldos (Artículo IV):

```sql
CREATE TABLE grupo (
  id                   TEXT PRIMARY KEY,
  nombre               TEXT    NOT NULL,
  moneda_codigo        TEXT    NOT NULL,          -- 'COP'
  moneda_exponente     INTEGER NOT NULL,          -- 0 para COP, 2 para USD
  hash_enlace_edicion  TEXT    NOT NULL UNIQUE,   -- SHA-256, nunca el token (DT-09)
  hash_enlace_lectura  TEXT    NOT NULL UNIQUE,
  creado_en            TEXT    NOT NULL
);

CREATE TABLE miembro (
  id        TEXT PRIMARY KEY,
  grupo_id  TEXT    NOT NULL REFERENCES grupo(id),
  nombre    TEXT    NOT NULL,
  activo    INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT    NOT NULL
);

CREATE TABLE objetivo (
  id           TEXT PRIMARY KEY,
  grupo_id     TEXT    NOT NULL REFERENCES grupo(id),
  nombre       TEXT    NOT NULL,
  descripcion  TEXT,
  monto_total  INTEGER NOT NULL CHECK (monto_total > 0),   -- unidad mínima (Art. III)
  modalidad    TEXT    NOT NULL CHECK (modalidad IN ('REPARTO_UNICO','CUOTAS_PERIODICAS')),
  estado       TEXT    NOT NULL CHECK (estado IN ('ACTIVO','CANCELADO','ARCHIVADO')),
  periodicidad TEXT             CHECK (periodicidad IS NULL OR periodicidad = 'MENSUAL'),
  fecha_inicio TEXT,                                        -- AAAA-MM-DD, se muestra DD-MM-AAAA (DT-11)
  fecha_limite TEXT,
  version      INTEGER NOT NULL DEFAULT 1,                  -- DT-10
  creado_en    TEXT    NOT NULL
);

CREATE TABLE involucrado (
  objetivo_id TEXT    NOT NULL REFERENCES objetivo(id),
  miembro_id  TEXT    NOT NULL REFERENCES miembro(id),
  tipo_parte  TEXT    NOT NULL CHECK (tipo_parte IN ('IGUAL','PORCENTAJE','MONTO_FIJO')),
  valor_parte INTEGER NOT NULL DEFAULT 0,   -- pb si PORCENTAJE, monto si MONTO_FIJO
  orden       INTEGER NOT NULL,             -- desempate de RN-04
  PRIMARY KEY (objetivo_id, miembro_id)
);

CREATE TABLE aporte (
  id               TEXT PRIMARY KEY,
  grupo_id         TEXT    NOT NULL REFERENCES grupo(id),
  objetivo_id      TEXT    NOT NULL REFERENCES objetivo(id),
  acreditado_a     TEXT    NOT NULL REFERENCES miembro(id),
  pagado_por       TEXT    NOT NULL REFERENCES miembro(id),   -- RN-15
  monto            INTEGER NOT NULL CHECK (monto > 0),        -- CB-04
  fecha_valor      TEXT    NOT NULL,
  periodo_indice   INTEGER,                                   -- NULL = imputar (RN-08)
  metodo           TEXT,
  nota             TEXT,
  registrado_por   TEXT    NOT NULL,      -- auto-declarado, NO es autenticación (RN-17)
  registrado_en    TEXT    NOT NULL,
  anulado_en       TEXT,                  -- RN-13: se anula, jamás se borra
  anulado_por      TEXT,
  anulacion_motivo TEXT
);
```

**Derivados, calculados por `core` en cada consulta** — nunca columnas:
periodos · obligación por involucrado · obligación por periodo · aportado · saldo ·
saldo a favor · faltante · recaudado · saldado · mora.

**Aislamiento (Artículo VI):** todas las consultas llevan `WHERE grupo_id = ?`, y el
`grupo_id` proviene **exclusivamente** de resolver el enlace, nunca de la petición del
cliente. Un único punto de entrada lo hace, y hay una prueba que intenta leer un objetivo de
otro grupo con un enlace válido y espera `404`.

## 5. Contratos del núcleo

Superficie pública de `packages/core`. Todo es función pura: sin `Date.now()`, sin `Math.random()`.

```ts
// Dinero (DT-04)
function minor(n: number): Minor;                 // valida entero seguro >= 0

// Reparto — RN-01, RN-02, RN-03, RN-04
function repartir(total: Minor, partes: Parte[]): ResultadoReparto;
//   Parte = { miembroId, tipo: 'IGUAL'|'PORCENTAJE'|'MONTO_FIJO', valor, orden }
//   Falla con detalle si los pb no suman 10.000 o los fijos no suman el total (RF-07).

// Reparto en periodos — RN-06
function repartirEnPeriodos(obligacion: Minor, nPeriodos: number): Minor[];

// Calendario — RN-05, incluido el desbordamiento de día de mes
function generarPeriodos(inicio: FechaCivil, limite: FechaCivil): Periodo[];

// Imputación en cascada — RN-08
function imputar(cuotas: Minor[], aportes: AporteImputable[]): ImputacionPorPeriodo[];

// Estado — RN-07, RN-09, RN-10, RN-12
function estadoObjetivo(o: Objetivo, aportes: Aporte[], hoy: FechaCivil): EstadoObjetivo;
function estadoGrupo(g: Grupo, os: Objetivo[], as: Aporte[], hoy: FechaCivil): EstadoGrupo;

// Validación previa a guardar — RF-07, CB-01..CB-03, CB-09
function validarObjetivo(borrador: BorradorObjetivo): Problema[];
```

`EstadoObjetivo` incluye el **desglose** que exige RF-15: por cada cifra, los identificadores
de los aportes que la componen. La interfaz no recalcula nada por su cuenta.

## 6. Estrategia de pruebas

| Nivel | Alcance | Herramienta |
|---|---|---|
| **Unitario (núcleo)** | Todo `RN-xx`, todo `CB-xx`. Es donde vive el riesgo real. | Vitest |
| **Propiedades** | INV-02, INV-03: la suma de partes iguala el total para entradas aleatorias. | Vitest + fast-check |
| **Límites arquitectónicos** | `core` sin dependencias ni imports externos (Artículo II). | Vitest |
| **Integración (API)** | Autorización por enlace, aislamiento entre grupos, `409` de concurrencia. | Vitest + SQLite en memoria |
| **Extremo a extremo** | Los flujos de HU-01, HU-05 y HU-06 en navegador. Solo esos tres: son los que, si se rompen, dejan la app inservible. | Playwright |
| **Manual** | RNF-03 (3 toques, 20 s) y RNF-08 (accesibilidad) en un teléfono real. | Guion en `docs/` |

**Mapa RN → prueba (RNF-10).** Cada archivo de prueba nombra la regla en el título:
`describe('RN-04 — distribución determinista del residuo', ...)`. Un script de verificación
recorre la spec, extrae los `RN-xx` y falla si alguno no aparece en ningún `describe`. La
trazabilidad deja de depender de que alguien se acuerde.

## 7. Riesgos

| ID | Riesgo | Prob. | Impacto | Mitigación | Señal temprana |
|---|---|---|---|---|---|
| **RG-01** | `node:sqlite` es experimental y su API puede cambiar entre versiones de Node. | Media | Medio | Todo el acceso a SQLite pasa por un solo módulo adaptador (~150 líneas). Cambiar a `better-sqlite3` toca un archivo. | Avisos de deprecación al arrancar o al actualizar Node. |
| **RG-02** | El enlace se filtra: se reenvía a un grupo de WhatsApp equivocado, o queda en una captura. | **Alta** | Medio | Rotación de enlaces desde el primer incremento (RF-03) y advertencia visible al compartir. | Es inevitable, no detectable. Por eso la rotación no puede quedar para después. |
| **RG-03** | El modelo de reparto no refleja cómo funciona la casa de verdad. | Media | **Alto** | Es exactamente el riesgo que ataca el Artículo IX: el Incremento 1 se usa con la familia antes de construir cuotas periódicas. | La familia sigue usando el chat o el cuaderno después del Incremento 1. |
| **RG-04** | Un error de residuo hace que las partes no sumen el total. | Baja | **Alto** | Pruebas de propiedades (DT-13) sobre toda entrada válida, más INV-02 verificado en el borde de la API. | Una prueba de propiedad roja. |
| **RG-05** | La escritura sin red falla y el usuario cree que su aporte quedó registrado. | Media | **Alto** | La interfaz **no** simula éxito: el aporte solo se da por registrado con confirmación del servidor. Cola de escritura descartada a propósito (§8). | Reportes de aportes "que se perdieron". |
| **RG-06** | Sobreingeniería por entusiasmo: colas, microservicios, tiempo real. | Media | Medio | Artículo VIII y esta tabla. Toda dependencia nueva exige una entrada `DT-xx` con requisito que la respalde. | Un `package.json` que crece sin que crezca la spec. |

## 8. Fuera del plan (y por qué)

- **Escritura offline con cola de sincronización.** Encolar aportes crea conflictos de
  imputación (RN-08) que la spec no define, y RG-05 muestra que fallar de forma visible es
  más seguro que sincronizar mal. Requiere spec propia.
- **Tiempo real (WebSocket).** RN-18 se resuelve con recarga y `409`. Un grupo familiar no
  edita concurrentemente lo suficiente como para pagar el costo.
- **Migraciones automáticas de esquema.** Hasta el primer despliegue en uso real se recrea la
  base. Desde ahí, migraciones SQL numeradas a mano.
- **Elección definitiva del proveedor de despliegue.** Se decide en el Incremento 1 con un
  despliegue real; DT-14 garantiza que ninguna otra decisión depende de esa.

## 9. Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0.0 | 2026-08-31 | Plan inicial aprobado sobre la spec 001 v1.0.0. |
| 1.1.0 | 2026-09-03 | DT-11: las fechas se muestran y se capturan en `DD-MM-AAAA`; el almacenamiento, la API y el núcleo siguen en `AAAA-MM-DD`. |
