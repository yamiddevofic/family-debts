# Deudas Familiares

Seguimiento de aportes para gastos comunes de la casa: cuánto cuesta algo, a quién le toca
cuánto, quién ya puso lo suyo y cuánto falta. Sin cuentas ni contraseñas: se comparte un
enlace y listo.

**Estado actual: MVP implementado (incrementos 1 a 3).** Falta desplegarlo y usarlo con la
familia una semana (T-040, T-042).

Este proyecto se construye con **Spec-Driven Development**. Ver [docs/SDD.md](docs/SDD.md).

## Qué resuelve

Una familia acuerda pagar algo entre varios: la nevera, el recibo de la luz, el arreglo del
techo. Ese acuerdo hoy vive en la memoria de alguien o en un chat, y tres meses después
nadie recuerda quién aportó qué. Este sistema convierte el acuerdo en un estado compartido,
visible y auditable.

Dos formas de organizar un objetivo, que son las que ocurren de verdad en casa:

- **Monto total repartido** — "la nevera cuesta $1.200.000 entre estos cuatro".
- **Cuotas mensuales hasta una fecha** — "juntamos $900.000 para el techo, de aquí a
  diciembre".

## Estructura

```
.specify/memory/constitution.md   Principios no negociables del proyecto
specs/001-objetivos-y-aportes/
  spec.md                         Especificación funcional (qué y por qué)
  plan.md                         Plan técnico (cómo) y decisiones DT-xx
  tasks.md                        Backlog en incrementos verticales
packages/core/                    Dominio puro: reparto, calendario, imputación, saldos
apps/api/                         HTTP + SQLite. Aquí viven el reloj y los secretos
apps/web/                         React + Vite
e2e/                              Playwright: HU-01, HU-05, HU-06
scripts/verificar-trazabilidad.mjs  Comprueba que cada RN-xx tenga prueba (RNF-10)
tools/eslint-reglas/              Regla que prohíbe dividir dinero (Artículo III)
docs/SDD.md                       El flujo de trabajo
docs/despliegue.md                Cómo se despliega y se respalda
docs/guion-de-pruebas-manuales.md RNF-03 y RNF-08 en un teléfono real
```

## Cómo se corre

```bash
npm install
npm run dev         # API en :8787 e interfaz en :5173, las dos a la vez
npm run verificar   # lint + trazabilidad + 196 pruebas
npm r
un e2e         # 5 pruebas Playwright sobre un móvil emulado
npm run build && npm run start --workspace=@deudas/api   # producción, en :8787
```

`npm run dev` arranca los dos procesos porque levantar solo la interfaz es un error fácil de
cometer: sin la API, el proxy de Vite responde a cada `/api/...` y en la consola del navegador
no queda ninguna pista de por qué. Si aun así ocurre, el proxy ahora responde `503` diciendo
exactamente qué falta.

## Stack

TypeScript de punta a punta, en un monorepo con `npm workspaces`:

| Paquete | Qué es | Dependencias |
|---|---|---|
| `packages/core` | Todo el dominio: reparto, calendario, imputación y saldos. Funciones puras. | **ninguna** |
| `apps/api` | HTTP con Hono y SQLite vía `node:sqlite`. Aquí viven el reloj y los secretos. | 2 |
| `apps/web` | React + Vite, empaquetada como PWA instalable. | 3 |

El razonamiento de cada elección, con sus alternativas descartadas, está en
[plan.md §2](specs/001-objetivos-y-aportes/plan.md).

## Avance

- [x] Constitución v1.1.0
- [x] Spec 001 v1.2.0 — **aprobada**
- [x] Plan técnico v1.1.0 — **aprobado**
- [x] Backlog en 5 incrementos
- [x] **Incremento 1 — Esqueleto caminante** *(falta T-040: desplegar)*
- [x] **Incremento 2 — Confianza**
- [x] **Incremento 3 — Cuotas mensuales** — **fin del MVP**
- [ ] T-042 — usarlo con la familia una semana *(ataca RG-03, el riesgo más caro)*
- [~] Incremento 4 — Repartos y ajustes *(hecho salvo porcentajes y montos fijos)*
- [ ] Incremento 5 — Compartir y perdurar

### Qué queda fuera del MVP, a propósito

Reparto por porcentajes y por montos fijos (RN-02, RN-03), rotación de enlaces *desde la
interfaz*, exportación (RF-18) y PWA instalable. El verificador de trazabilidad las lista
como pospuestas en cada ejecución, con el incremento que las traerá: posponer una regla es
un acto visible, no un olvido (Artículo X).
