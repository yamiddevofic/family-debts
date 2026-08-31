# Constitución del proyecto — Deudas Familiares

**Versión:** 1.0.0 · **Ratificada:** 2026-08-31 · **Última enmienda:** 2026-08-31

Este documento define los principios no negociables del proyecto. Toda especificación,
plan técnico y tarea de implementación debe poder justificarse contra estos principios.
Cuando un plan los contradiga, o el plan cambia o la constitución se enmienda de forma
explícita y versionada — nunca se ignoran en silencio.

---

## Artículo I — La especificación es la fuente de verdad

El código es una consecuencia de la spec, no al revés.

1. Ninguna funcionalidad se implementa sin un requisito identificado (`RF-xx`) o una
   regla de negocio (`RN-xx`) en una spec aprobada.
2. Si durante la implementación aparece una decisión que la spec no cubre, se **detiene
   la implementación y se enmienda la spec**. No se decide en el código.
3. Todo cambio de comportamiento se rastrea: `spec → plan → tareas → commit`. El mensaje
   de commit referencia el identificador del requisito.

**Por qué:** el valor de este proyecto no es la app, es que el modelo de deudas sea
correcto y explicable a la familia. Un modelo mal definido produce discusiones reales
sobre dinero real.

## Artículo II — El núcleo es puro y determinista

La lógica de reparto, obligaciones y saldos vive en un núcleo sin dependencias.

1. El núcleo **no** conoce red, base de datos, sistema de archivos, reloj del sistema ni
   framework de UI. El tiempo y los identificadores entran como parámetros.
2. Dada la misma entrada, el núcleo produce siempre exactamente la misma salida.
3. La UI y la persistencia son adaptadores intercambiables alrededor del núcleo.

**Por qué:** es el eje de reutilización elegido. Un núcleo puro se prueba exhaustivamente
sin infraestructura y se reusa desde web, CLI o móvil sin reescribirlo.

## Artículo III — El dinero es un entero

1. Todo monto se representa como **entero en la unidad mínima** de la moneda del grupo.
   Nunca `float`, nunca `double`, nunca decimal binario.
2. Cada grupo declara su moneda y su exponente decimal (COP → 0, USD → 2).
3. Todo reparto que produzca residuo debe distribuirlo de forma **determinista y
   documentada**, y la suma de las partes debe igualar el total **exactamente**.

**Por qué:** un centavo perdido en un reparto es un error de confianza, no de redondeo.

## Artículo IV — Los saldos se derivan, jamás se almacenan

1. El estado persistido son **hechos**: miembros, objetivos, obligaciones y aportes.
2. "Cuánto debe Ana", "cuánto falta para la nevera" y "quién está en mora" son siempre
   funciones puras calculadas sobre esos hechos.
3. Está prohibido guardar un saldo como campo mutable actualizable por escritura.

**Por qué:** los saldos almacenados se desincronizan. Un saldo derivado no puede mentir.

## Artículo V — El historial es inmutable y auditable

1. Un aporte registrado no se edita destructivamente ni se borra en silencio: se **anula**
   dejando rastro de quién lo anuló, cuándo y por qué.
2. Toda cifra mostrada debe poder desglosarse hasta los hechos que la producen.
3. Ningún miembro con aportes registrados puede eliminarse; se desactiva.

**Por qué:** ante un desacuerdo familiar, la app debe poder mostrar el porqué de un número.

## Artículo VI — Multi-grupo desde el primer día

1. Toda entidad del dominio pertenece a un grupo. No existe estado global compartido
   entre grupos ni un "grupo por defecto" implícito.
2. Ninguna consulta puede devolver datos de un grupo sin haber verificado el acceso a ese
   grupo. El aislamiento se prueba explícitamente.
3. No se codifican en duro nombres, monedas, categorías ni miembros.

**Por qué:** "reutilizable" se pidió de forma explícita; multi-grupo es su forma concreta.

## Artículo VII — Las pruebas son el contrato ejecutable de la spec

1. Cada regla de negocio (`RN-xx`) tiene al menos una prueba que la nombra en su título.
2. Los casos borde listados en la spec se prueban antes de considerarse implementados.
3. Una prueba que falla es una spec violada, nunca una prueba a ajustar para que pase.

## Artículo VIII — Simplicidad obligatoria

1. No se introduce infraestructura (backend, cola, caché, ORM, servicio externo) sin un
   requisito de la spec que la exija. La justificación se escribe en el plan.
2. Ante dos diseños que satisfacen la spec, gana el que un familiar no técnico entendería
   mejor si se lo explicaran en voz alta.
3. Lo que no está en el alcance de la spec no se construye "por si acaso".

---

## Gobernanza

- **Versionado:** MAJOR = se elimina o invierte un principio · MINOR = se añade un
  principio o se amplía uno existente · PATCH = redacción, ejemplos, aclaraciones.
- **Enmienda:** se propone en la spec o el plan que la motiva, se registra aquí con fecha
  y se anota el impacto sobre los artefactos ya escritos.
- **Precedencia:** esta constitución prevalece sobre cualquier spec, plan o preferencia de
  implementación. Ante conflicto, gana el artículo de número menor.
