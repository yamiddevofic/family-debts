# Cómo se trabaja en este repositorio

Este proyecto sigue **Spec-Driven Development**: la especificación es el artefacto
principal y el código es su consecuencia. El orden no es negociable.

```
Constitución  →  Spec  →  Clarificación  →  Plan  →  Tareas  →  Implementación
   (una vez)     (qué)     (cerrar huecos)   (cómo)   (pasos)     (código)
```

## Las fases

| Fase | Artefacto | Pregunta que responde | Puerta de salida |
|---|---|---|---|
| **Constitución** | `.specify/memory/constitution.md` | ¿Qué principios no se rompen nunca? | Ratificada por el responsable. |
| **Spec** | `specs/NNN-slug/spec.md` | ¿Qué debe pasar y por qué? | Sin `[PENDIENTE]`; preguntas abiertas resueltas o con propuesta aceptada. |
| **Clarificación** | Sección 10 de la spec | ¿Qué quedó ambiguo? | Toda `PA-xx` cerrada. |
| **Plan** | `specs/NNN-slug/plan.md` | ¿Cómo se construye? | Revisión constitucional sin excepciones injustificadas. |
| **Tareas** | `specs/NNN-slug/tasks.md` | ¿En qué orden y cómo se comprueba? | Cada tarea con verificación explícita. |
| **Implementación** | Código y pruebas | — | Todas las tareas hechas; ninguna prueba roja. |

## Reglas del flujo

1. **No se escribe código sin tarea, ni tarea sin requisito.** Si algo hace falta y no está
   en la spec, se enmienda la spec primero.
2. **El plan no puede empezar con la spec en borrador.** Planificar sobre una spec inestable
   produce trabajo que se bota.
3. **Una ambigüedad detectada se resuelve, no se adivina.** Va a la sección 10 de la spec.
4. **Los identificadores viajan.** `RN-04` aparece en la spec, en el plan, en la tarea, en el
   nombre de la prueba y en el mensaje del commit. Así se puede ir de un número en pantalla
   hasta la línea que lo produce.

## Reutilizar este repositorio como plantilla

1. Copiar `.specify/` y `docs/SDD.md`.
2. Reescribir la constitución: los principios son de cada proyecto, aunque los Artículos I,
   VII y VIII suelen sobrevivir tal cual.
3. Crear `specs/001-<slug>/spec.md` desde `.specify/templates/spec-template.md`.
4. Borrar `specs/001-objetivos-y-aportes/`, que es contenido de este proyecto.
