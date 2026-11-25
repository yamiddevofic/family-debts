import type { Minor } from './tipos.js';

/**
 * Dinero — Artículo III y DT-04.
 *
 * Un monto es siempre un entero en la unidad mínima de la moneda del grupo: pesos en COP,
 * centavos en USD (CB-14). No hay coma flotante en ninguna parte del dominio, y el tipo
 * marcado `Minor` impide pasar un `number` cualquiera donde se espera dinero.
 *
 * Este módulo solo suma, resta y compara. Dividir y multiplicar dinero está prohibido
 * fuera de `reparto.ts`, y hay una regla de ESLint que lo hace cumplir.
 */

export class ErrorDeMonto extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeMonto';
  }
}

/** Constructor validado: rechaza decimales, negativos y todo lo que no sea entero seguro. */
export function minor(n: number): Minor {
  if (!Number.isSafeInteger(n)) {
    throw new ErrorDeMonto(
      `Un monto debe ser un entero seguro en la unidad mínima de la moneda; se recibió ${String(n)}.`,
    );
  }
  if (n < 0) {
    throw new ErrorDeMonto(`Un monto no puede ser negativo (INV-04); se recibió ${String(n)}.`);
  }
  return n as Minor;
}

export const CERO: Minor = 0 as Minor;

export function esMonto(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
}

export function sumar(...montos: Minor[]): Minor {
  let total = 0;
  for (const m of montos) total += m;
  return minor(total);
}

/** Resta saturada: nunca baja de cero, porque un `Minor` negativo no existe (INV-04). */
export function restarSinBajarDeCero(a: Minor, b: Minor): Minor {
  return minor(Math.max(0, a - b));
}

/** Diferencia con signo. Devuelve un entero corriente, no un `Minor`: puede ser negativo. */
export function diferencia(a: Minor, b: Minor): number {
  return a - b;
}

export function minimo(a: Minor, b: Minor): Minor {
  return a < b ? a : b;
}

/** Parte positiva de un entero con signo: lo que se debe, cuando el saldo es deuda. */
export function positivo(n: number): Minor {
  return minor(Math.max(0, n));
}

/** Parte negativa de un entero con signo, en positivo: el saldo a favor (RN-09). */
export function negativo(n: number): Minor {
  return minor(Math.max(0, -n));
}
