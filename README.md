# Deudas Familiares

Seguimiento de aportes para gastos comunes de la casa: cuánto cuesta algo, a quién le toca
cuánto, quién ya puso lo suyo y cuánto falta. Sin cuentas ni contraseñas: se comparte un
enlace y listo.

**Estado actual: spec, plan y backlog listos. La implementación arranca por el Incremento 1.**

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
.specify/
  memory/constitution.md      Principios no negociables del proyecto
  templates/                  Plantillas de spec, plan y tareas
specs/
  001-objetivos-y-aportes/
    spec.md                   Especificación funcional (qué y por qué)
    plan.md                   Plan técnico (cómo) y decisiones DT-xx
    tasks.md                  Backlog en incrementos verticales
docs/SDD.md                   El flujo de trabajo
```

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
- [x] Spec 001 v1.0.0 — **aprobada**
- [x] Plan técnico v1.0.0 — **aprobado**
- [x] Backlog en 5 incrementos
- [ ] **Incremento 1 — Esqueleto caminante** ← siguiente
- [ ] Incremento 2 — Confianza
- [ ] Incremento 3 — Cuotas mensuales *(fin del MVP)*
- [ ] Incremento 4 — Repartos y ajustes
- [ ] Incremento 5 — Compartir y perdurar
