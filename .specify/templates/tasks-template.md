# Tareas — Spec NNN

| Campo | Valor |
|---|---|
| **Spec** | `NNN-slug` v0.0.0 |
| **Plan** | `plan.md` v0.0.0 |
| **Fecha** | AAAA-MM-DD |

> Cada tarea es pequeña, verificable y rastreable. Si no se puede decir cómo se comprueba
> que quedó hecha, no es una tarea: es un deseo.

## Convenciones

- `T-xxx` identificador · `[P]` puede ejecutarse en paralelo con otras `[P]` del mismo bloque.
- Toda tarea declara los requisitos que satisface y los archivos que toca.
- Las tareas de prueba de una regla van **antes** que su implementación.

## Bloque 0 — Cimientos
| ID | Tarea | Requisitos | Verificación |
|---|---|---|---|
| T-001 | | | |

## Bloque 1 — Núcleo de dominio
## Bloque 2 — Persistencia
## Bloque 3 — Interfaz
## Bloque 4 — Cierre

## Definición de "hecho"

Una tarea está hecha cuando:

1. Su verificación pasa de forma automatizada.
2. No introdujo comportamiento que la spec no pide.
3. El commit referencia el `RF-xx` o `RN-xx` correspondiente.
