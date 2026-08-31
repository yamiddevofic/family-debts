# Deudas Familiares

Seguimiento de aportes para gastos comunes de la casa: cuánto cuesta algo, a quién le toca
cuánto, quién ya puso lo suyo y cuánto falta. Sin cuentas ni contraseñas: se comparte un
enlace y listo.

**Estado actual: especificación en borrador. Todavía no hay código.**

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
    plan.md                   Plan técnico (cómo) — pendiente
    tasks.md                  Tareas ejecutables — pendiente
docs/SDD.md                   El flujo de trabajo
```

## Avance

- [x] Constitución v1.0.0
- [x] Spec 001 — borrador v0.1.0
- [ ] Cerrar las preguntas abiertas (§10 de la spec)
- [ ] Aprobar la spec
- [ ] Plan técnico y elección de stack
- [ ] Tareas
- [ ] Implementación
