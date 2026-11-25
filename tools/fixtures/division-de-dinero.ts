/**
 * Caso de prueba de la regla `constitucion/sin-dividir-dinero` (T-002).
 *
 * Este archivo divide y multiplica montos `Minor` fuera de `core/src/reparto.ts`, que es
 * exactamente lo que el Artículo III prohíbe. Existe para que la prueba pueda comprobar que
 * el linter lo detecta: si algún día deja de dar error, la salvaguarda se rompió sin que
 * nadie se diera cuenta. Está fuera del `npm run lint` normal a propósito.
 */
import { minor } from '../../packages/core/src/dinero.js';

export function repartoIngenuo(total: number, entreCuantos: number): number {
  const monto = minor(total);
  // Cada una de estas líneas debe hacer fallar el linter.
  const porCabeza = monto / entreCuantos;
  const doble = monto * 2;
  const resto = monto % entreCuantos;
  return porCabeza + doble + resto;
}

export function sumaPermitida(a: number, b: number): number {
  // Sumar y restar dinero sí está permitido: no produce fracciones.
  return minor(a) + minor(b) - minor(0);
}
