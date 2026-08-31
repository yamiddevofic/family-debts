# Plan técnico — Spec NNN

| Campo | Valor |
|---|---|
| **Spec** | `NNN-slug` v0.0.0 |
| **Estado** | 🟡 Propuesto / 🟢 Aprobado |
| **Fecha** | AAAA-MM-DD |

> El plan responde **cómo**. Solo puede escribirse sobre una spec aprobada, y todo lo que
> aparezca aquí debe rastrearse a un requisito de esa spec.

## 1. Revisión constitucional
Tabla artículo por artículo: cómo lo cumple este plan, o qué excepción se solicita y por qué.
Una excepción sin justificación escrita invalida el plan.

## 2. Decisiones técnicas
Una entrada por decisión: `DT-xx`.

- **Decisión:** qué se eligió.
- **Requisitos que la exigen:** `RF-xx`, `RNF-xx`.
- **Alternativas consideradas:** y por qué se descartaron.
- **Consecuencias:** lo que esta decisión hace fácil y lo que hace difícil.
- **Reversibilidad:** cuánto cuesta cambiar de opinión más adelante.

## 3. Arquitectura
Capas, límites y dirección de las dependencias. Qué es núcleo puro y qué es adaptador.
El diagrama debe dejar ver que el núcleo no depende de nada.

## 4. Modelo de datos
Traducción del modelo de dominio a estructuras concretas. Se marca explícitamente qué es
**hecho almacenado** y qué es **derivado**, para no violar el Artículo IV.

## 5. Contratos
Interfaces públicas del núcleo y de los adaptadores. Firmas, errores posibles, precondiciones.

## 6. Estrategia de pruebas
Qué se prueba en el núcleo, qué en integración, qué a mano. Mapa `RN-xx` → prueba.

## 7. Riesgos
`RG-xx`: riesgo, probabilidad, impacto, mitigación, señal temprana.

## 8. Fuera del plan
Lo que deliberadamente no se resuelve todavía, y qué haría falta para abordarlo.
