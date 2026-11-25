# Guion de pruebas manuales

Dos requisitos no se pueden automatizar de forma honesta y se verifican a mano, en un
teléfono real, antes de dar por cerrado un incremento (plan §6).

| Campo | Valor |
|---|---|
| **Requisitos** | RNF-03 (registro sin fricción), RNF-08 (accesibilidad) |
| **Dispositivo** | Teléfono real, no emulador. Anotar modelo y navegador. |
| **Frecuencia** | Al cerrar cada incremento, y ante cualquier cambio del formulario de aporte. |

---

## RNF-03 — Registrar un aporte toma 3 interacciones y menos de 20 segundos

**Preparación.** Un grupo con al menos un objetivo activo en el que la persona esté
involucrada y deba dinero. La persona ya se identificó en ese dispositivo.

**Procedimiento.** Cronómetro en marcha al abrir el enlace ya cargado en el tablero.

1. Tocar **Registrar aporte** en la tarjeta del objetivo.
2. Comprobar que el monto viene prellenado con lo que se debe.
3. Tocar **Guardar aporte**.

**Criterio de aceptación.**

- [ ] Dos toques bastan para el caso corriente ("puse mi parte completa"). El presupuesto de
      RNF-03 son tres; el tercero queda para corregir el monto.
- [ ] Menos de 20 segundos desde el primer toque hasta ver el saldo actualizado.
- [ ] El saldo cambia en pantalla sin recargar a mano.

**Anotar:** tiempo medido, número de toques, y cualquier duda que la persona haya expresado
en voz alta.

---

## RNF-08 — Accesibilidad

### Tamaño de texto del sistema

1. Subir el tamaño de fuente del sistema al máximo (Android: Ajustes → Pantalla → Tamaño de
   fuente. iOS: Ajustes → Pantalla y brillo → Tamaño del texto).
2. Recorrer tablero, detalle de objetivo, formulario de aporte e historial.

- [ ] No se corta ni se superpone ningún texto.
- [ ] Las tablas de cuotas y de desglose se pueden desplazar en horizontal sin que la página
      entera se desplace.
- [ ] Ningún botón queda fuera de la pantalla.

### Objetivos táctiles

- [ ] Todo lo pulsable mide al menos 44 px de lado (los estilos fijan `--toque: 2.75rem`).
- [ ] Se puede tocar cada botón con el pulgar sin acertarle al de al lado.

### Contraste y color

- [ ] Contraste AA en modo claro y en modo oscuro (el sistema alterna solo).
- [ ] **Ningún estado se comunica solo con color.** Verificar en escala de grises que se
      siguen distinguiendo: saldado (✓), en mora (⚠), anulado (tachado), futuro (etiqueta).

### Lector de pantalla

Con TalkBack o VoiceOver, recorrer el tablero:

- [ ] Los encabezados se anuncian en orden y "Lo mío" viene antes que los totales del grupo.
- [ ] Las barras de avance anuncian su porcentaje.
- [ ] Cada campo del formulario de aporte anuncia su etiqueta y su texto de ayuda.
- [ ] Los errores se anuncian al aparecer (van con `role="alert"`).

---

## Registro de ejecuciones

| Fecha | Incremento | Dispositivo | RNF-03 | RNF-08 | Observaciones |
|---|---|---|---|---|---|
| | | | | | |
