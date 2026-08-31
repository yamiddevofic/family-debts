# Spec NNN — <nombre de la funcionalidad>

| Campo | Valor |
|---|---|
| **Identificador** | `NNN-slug` |
| **Estado** | 🟡 Borrador / 🟢 Aprobada / ⚪ Obsoleta |
| **Versión** | 0.1.0 |
| **Fecha** | AAAA-MM-DD |
| **Constitución** | vX.Y.Z |

> Describe **qué** y **por qué**. Nunca **cómo**. Sin lenguajes, frameworks ni bibliotecas.
> Si al escribir aparece una decisión técnica, va al plan, no aquí.

## 1. Problema
Qué duele hoy, para quién, y qué falla concreta produce. Sin solución todavía.

## 2. Usuarios y contexto de uso
Perfiles, su necesidad dominante y las condiciones reales de uso (dispositivo, frecuencia,
competencia digital, contra qué compite la herramienta).

## 3. Alcance
### 3.1 Dentro
### 3.2 Fuera — con la **razón** de cada exclusión
### 3.3 Supuestos — `SUP-xx`, cada uno falsable

## 4. Modelo de dominio
### 4.1 Entidades — nombre, propósito y atributos, en el lenguaje del usuario
### 4.2 Invariantes — `INV-xx`, lo que siempre debe ser cierto

## 5. Reglas de negocio
`RN-xx`, una por regla, cada una con **un ejemplo numérico concreto** y, cuando la regla sea
discutible, un párrafo **"Por qué"**. Si no se puede escribir un ejemplo, la regla está mal
definida.

## 6. Historias de usuario
`HU-xx` en formato "Como … quiero … para …", cada una con criterios de aceptación
**Dado / cuando / entonces**. Los criterios deben poder convertirse en prueba sin traducción.

## 7. Requisitos funcionales
Tabla `RF-xx` → reglas que lo gobiernan → historia que lo origina.

## 8. Requisitos no funcionales
Tabla `RNF-xx` con **criterio verificable**. "Rápido" no es un requisito; "menos de 100 ms
con 2.000 registros" sí.

## 9. Casos borde
Tabla `CB-xx` con situación y comportamiento esperado. Aquí es donde una spec se gana el
sueldo.

## 10. Preguntas abiertas
Tabla `PA-xx` con estado y **propuesta por defecto**, para que la duda no bloquee el avance.

## 11. Criterios de éxito
Cómo se sabrá, en uso real, que valió la pena. Observables, no aspiracionales.

## 12. Glosario
## 13. Trazabilidad
## 14. Registro de cambios
