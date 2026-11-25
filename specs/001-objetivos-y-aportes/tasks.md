# Backlog — Spec 001

| Campo | Valor |
|---|---|
| **Spec** | `001-objetivos-y-aportes` v1.0.0 |
| **Plan** | `plan.md` v1.0.0 |
| **Constitución** | v1.1.0 (Artículos IX y X) |
| **Fecha** | 2026-08-31 |

---

## Cómo está cortado

Cinco incrementos **verticales**: cada uno atraviesa núcleo, API e interfaz, y al terminarlo
la familia puede usarlo de verdad (Artículo IX). No hay un incremento "de backend".

| # | Incremento | Objetivo — qué se puede hacer al terminarlo | Requisitos |
|---|---|---|---|
| **1** | **Esqueleto caminante** | Crear un grupo, mandar el enlace, y que alguien registre un aporte real a un objetivo repartido en partes iguales. | RF-01–05, 07*, 08, 09*, 13, 20, 21 |
| **2** | **Confianza** | Anular un aporte errado, ver el desglose de cualquier cifra, registrar que uno pagó por otro, ver saldos a favor. | RF-09, 11, 12, 15 |
| **3** | **Cuotas mensuales** | Crear objetivos por cuotas hasta una fecha y ver quién está en mora. | RF-06, 10, 14 |
| **4** | **Repartos y ajustes** | Repartir por porcentajes o montos fijos, cambiar objetivos ya en marcha, cancelar y archivar. | RF-07, 16, 17, 19 |
| **5** | **Compartir y perdurar** | Enlace de solo lectura, exportación completa, instalable en el teléfono. | RF-02, 03, 18, RNF-05 |

`*` parcial en ese incremento; se completa después.

**El MVP son los incrementos 1 a 3.** Cubren las dos modalidades reales de la casa y la
auditabilidad mínima para que las cifras se sostengan en una discusión. Los incrementos 4 y
5 son producto, no MVP.

**El backlog se detalla al empezar cada incremento.** Abajo está el 1 al detalle, el 2 y el 3
a nivel de historia, y el 4 y 5 solo enunciados. Planificar al detalle lo que todavía no se
ha aprendido del uso real es desperdicio: RG-03 dice que el modelo podría cambiar.

## Definición de Listo (para empezar una tarea)

1. Cita al menos un `RF-xx` o `RN-xx` de la spec aprobada.
2. Su verificación está escrita y es observable por alguien que no la implementó.
3. Cabe en una sesión de trabajo. Si no cabe, se parte.

## Definición de Hecho (para cerrarla)

1. Su verificación pasa automatizada, salvo las marcadas como manuales.
2. Toda `RN-xx` que toca tiene prueba que la nombra (RNF-10) y el verificador de
   trazabilidad pasa.
3. No introdujo comportamiento que la spec no pide (Artículo I).
4. El commit referencia el requisito.
5. Está integrado y desplegable. No existe "hecho, falta integrar" (Artículo IX).

---

## Incremento 1 — Esqueleto caminante

> **Objetivo:** que la familia registre su primer aporte real en la app. Nada más.
> Todo lo que no haga falta para eso, no entra — aunque sea fácil (Artículo VIII).

### Bloque 0 — Cimientos

| ID | Tarea | Requisitos | Verificación |
|---|---|---|---|
| ✅ T-001 | Monorepo `npm workspaces` con `packages/core`, `apps/api`, `apps/web`; TypeScript estricto y Vitest. | DT-01, DT-02 | `npm test` corre en los tres paquetes desde la raíz. |
| ✅ T-002 `[P]` | ESLint con regla que prohíbe `/` y `*` sobre `Minor` fuera de `core/src/reparto.ts`. | Art. III, DT-04 | Un archivo de prueba con una división de montos hace fallar el linter. |
| ✅ T-003 `[P]` | Verificador de trazabilidad: extrae los `RN-xx` de `spec.md` y falla si alguno no aparece en un `describe`. | RNF-10, Art. VII | Borrar un `describe` hace fallar el script. |
| ✅ T-004 `[P]` | Prueba de límite: `core/package.json` sin `dependencies` y sin imports no relativos. | Art. II, RNF-02 | Añadir cualquier dependencia a `core` pone la prueba en rojo. |

### Bloque 1 — Núcleo de dominio

| ID | Tarea | Requisitos | Verificación |
|---|---|---|---|
| ✅ T-010 | Tipos base: `Minor`, `minor()`, `FechaCivil`, identificadores. | Art. III, DT-04, DT-11 | `minor(1.5)` y `minor(-1)` lanzan; `minor(33334)` pasa. |
| ✅ T-011 | **Pruebas primero** de RN-01 y RN-04 con el caso $100.000 entre 3. | RN-01, RN-04 | Rojas antes de T-012. |
| ✅ T-012 | `repartir()` para `IGUAL`, con residuo por mayor resto y desempate por `orden`. | RN-01, RN-04, RF-08 | T-011 en verde: `33.334 / 33.333 / 33.333`. |
| ✅ T-013 | Prueba de propiedad de INV-02 con `fast-check`. | INV-02, RNF-01, DT-13 | 1.000 casos aleatorios: la suma de partes siempre iguala el total. |
| ✅ T-014 | `estadoObjetivo()` para `REPARTO_UNICO`: obligación, aportado, saldo, faltante, recaudado, saldado. | RN-07, RN-10, RF-13 | Casos de la spec, incluido CB-10 (todo anulado → recaudado 0). |
| ✅ T-015 | `validarObjetivo()`: sin involucrados, monto ≤ 0, un solo involucrado. | CB-01, CB-02, CB-03, RF-07 | Cada caso borde con su prueba nombrada. |

### Bloque 2 — Persistencia y API

| ID | Tarea | Requisitos | Verificación |
|---|---|---|---|
| ✅ T-020 | Esquema SQL del plan §4 y adaptador único sobre `node:sqlite`. | DT-05, Art. IV | El esquema no tiene ninguna columna de saldo, obligación ni pagado. |
| ✅ T-021 | Generar enlaces de 160 bits y guardar solo su SHA-256. | RN-17, RNF-06, DT-09 | La base no contiene ningún token en claro; el token se devuelve una sola vez. |
| ✅ T-022 | Punto único de resolución `enlace → grupo_id`, con permiso de lectura o edición. | RF-02, RN-17, Art. VI | Enlace inválido → `404` sin revelar si el grupo existe. |
| ✅ T-023 | Prueba de aislamiento: leer un objetivo de otro grupo con un enlace válido. | INV-01, RF-20, Art. VI | Responde `404`, no `403`: no se confirma la existencia. |
| ✅ T-024 | `POST /grupos` y `POST /grupos/:t/rotar-enlace`. | RF-01, RF-03 | Tras rotar, el enlace anterior responde `404` de inmediato (RG-02). |
| ✅ T-025 | Miembros: alta, edición, desactivar; eliminar solo sin aportes. | RF-04, RN-14 | Eliminar un miembro con aportes responde `409` y sugiere desactivar. |
| ✅ T-026 | `POST /objetivos` con modalidad `REPARTO_UNICO` y reparto `IGUAL`. | RF-05, RF-07 | Reparto inválido responde `422` diciendo cuánto falta o sobra. |
| ✅ T-027 | `POST /aportes` con monto, fecha, acreditado y quién registra. | RF-09, CB-04, CB-05 | Monto 0 o negativo → `422`; fecha anterior al objetivo → aceptado. |
| ✅ T-028 | `GET /estado`: el grupo completo calculado por `core`, con desglose. | RF-13, RF-15, RNF-04 | 20 miembros, 100 objetivos y 2.000 aportes en menos de 100 ms. |
| ✅ T-029 | Enmascarar el token en registros; `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex`. | RNF-06, DT-09 | Ninguna línea de registro contiene un token completo. |

### Bloque 3 — Interfaz

| ID | Tarea | Requisitos | Verificación |
|---|---|---|---|
| ✅ T-030 | Vite + React + ruta `/g/:token`, con TanStack Query. | DT-07, DT-08 | La consulta sigue mostrando datos con la red desconectada (RNF-05). |
| ✅ T-031 | Crear grupo y mostrar el enlace **una sola vez**, con la advertencia de que no se recupera. | RF-01, DT-09 | El texto de advertencia es visible sin desplazarse. |
| ✅ T-032 | "¿Quién eres?" al abrir el enlace, recordado en el dispositivo, cambiable, con aviso de que no es autenticación. | RF-21, RN-17 | Recargar mantiene la identidad; otro navegador vuelve a preguntar. |
| ✅ T-033 | Tablero: por objetivo cuánto falta y cuánto se lleva; arriba del todo, **lo mío**. | HU-06, RF-13 | Un familiar que no creó el grupo responde "¿cuánto debo?" sin ayuda. |
| ✅ T-034 | Registrar aporte en 3 interacciones o menos desde el tablero. | RNF-03, RF-09 | Cronometrado en un teléfono real: menos de 20 segundos. |
| ✅ T-035 `[P]` | Formato de moneda COP sin decimales y con separadores locales. | RNF-07 | `1200000` se muestra como `$1.200.000`. |
| ✅ T-036 `[P]` | `aVista` / `deVista`: las fechas se muestran y se capturan en `DD-MM-AAAA`; `core` y la API siguen en `AAAA-MM-DD`. | RNF-03, DT-11 | Ida y vuelta sobre fechas aleatorias; ninguna fuente de `core` ni de `api` contiene `DD-MM-AAAA`. |

### Bloque 4 — Cierre del incremento

| ID | Tarea | Requisitos | Verificación |
|---|---|---|---|
| T-040 | Desplegar: un proceso, un volumen, y elegir destino concreto. | DT-14 | La familia abre el enlace desde su teléfono, fuera de la red de casa. |
| ✅ T-041 | Extremo a extremo de HU-01, HU-05 y HU-06. | HU-01, HU-05, HU-06 | 5 pruebas Playwright en verde sobre un móvil emulado. Falta repetirlas contra el despliegue real. |
| T-042 | **Usarlo con la familia una semana** y anotar lo observado. | Art. IX, RG-03 | Documento con lo aprendido, que alimenta el Incremento 2. |

> T-042 no es opcional ni ceremonia. Es la tarea que ataca RG-03, el riesgo más caro del
> proyecto: que el modelo de reparto no refleje cómo funciona la casa de verdad.

---

## Incremento 2 — Confianza

> **Objetivo:** que ante un desacuerdo, la app cierre la conversación en vez de abrirla.

- [x] Anular un aporte con motivo obligatorio, visible y tachado (RF-12, RN-13).
- [x] Desglose de cualquier cifra hasta los aportes que la componen (RF-15).
- [x] Distinguir quién pagó de a quién se acredita (RF-09 completo, RN-15).
- [x] Saldo a favor mostrado explícitamente (RF-11, RN-09).
- [x] Historial del grupo, ordenado y filtrable por miembro y por objetivo.

**Cerrado.** Un aporte anulado sigue en la tabla `aporte` con su motivo, autor y fecha; el
único `UPDATE` que toca esa tabla es el de la anulación, y hay una prueba que lo comprueba
leyendo la fila directamente.

## Incremento 3 — Cuotas mensuales

> **Objetivo:** cubrir la segunda forma real de organizar plata en la casa.

- [x] Calendario de RN-05, incluido el desbordamiento de día de mes, en núcleo puro.
- [x] Reparto de la obligación entre periodos (RF-08 completo, RN-06).
- [x] Imputación en cascada al periodo pendiente más antiguo (RF-10, RN-08).
- [x] Mora calculada a una `fechaReferencia` dada (RF-14, RN-12).
- [x] Vista de calendario: qué toca este mes y qué quedó debiendo.

**Cerrado.** La mora se calcula dos veces: una con todos los aportes, para los saldos, y otra
solo con los que ya existían a la fecha de referencia, para la mora. Sin esa segunda pasada,
un aporte con fecha futura rescataría un periodo vencido y CB-06 quedaría incumplido.

**Aquí termina el MVP.**

## Incremento 4 — Repartos y ajustes

- [ ] Porcentajes y montos fijos (RN-02, RN-03) — **lo único que queda**.
- [x] Editar objetivos con aportes y su advertencia (RF-16, RN-11).
- [x] Cancelar, archivar y reactivar (RF-17, RN-16).
- [x] Conflicto `409` por versión (RF-19, RN-18, DT-10).
- [x] Eliminar un objetivo sin aportes (RF-22, RN-16) — nace de la spec v1.1.0.
- [x] Eliminar un grupo entero con confirmación escrita (RF-23, RN-19) — spec v1.2.0.

Se adelantó casi entero al pedirlo el uso real, antes que RN-02 y RN-03. El orden del
backlog no es una promesa: lo que pide quien usa la app manda sobre lo que estaba escrito.

## Incremento 5 — Compartir y perdurar

Enlace de solo lectura (RF-02) · rotación desde la interfaz (RF-03) · exportación completa
(RF-18, RNF-09) · PWA instalable con lectura offline (RNF-05).

---

## Cadencia de trabajo

Proyecto de una persona: se conservan las prácticas que aportan y se descarta la ceremonia
que no.

| Práctica | Cómo se aplica aquí |
|---|---|
| **Incremento** | Se cierra cuando su objetivo se cumple, no en una fecha fija. Si se alarga, se recorta alcance, nunca corrección (Artículo X). |
| **Backlog vivo** | Este archivo. Lo aprendido en T-042 entra aquí antes de seguir. |
| **Retrospectiva** | Al cerrar cada incremento, tres líneas: qué funcionó, qué no, qué se cambia. Si toca un principio, se enmienda la constitución. |
| **Integración continua** | Cada tarea se integra al terminarla. Nada de ramas largas. |
| **Deuda técnica** | Se anota como `RG-xx` en el plan, no como comentario `TODO` en el código. |

## Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0.0 | 2026-08-31 | Backlog inicial. Incremento 1 al detalle; 2 y 3 a nivel de historia. |
| 1.1.0 | 2026-09-03 | T-036: formato de fecha `DD-MM-AAAA` en la interfaz (DT-11). |
| 1.3.0 | 2026-09-04 | Incremento 4 casi completo: editar, cancelar/archivar/reactivar, conflicto por versión, eliminar objetivo y eliminar grupo. Solo quedan RN-02 y RN-03. |
| 1.2.0 | 2026-09-03 | MVP implementado: incrementos 1, 2 y 3 cerrados. Quedan abiertas T-040 (desplegar, falta elegir proveedor) y T-042 (usarlo con la familia). |
