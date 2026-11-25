import { describe, expect, it } from 'vitest';
import { CERO, diferencia, minimo, minor, negativo, positivo, restarSinBajarDeCero, sumar } from '../src/dinero.js';
import { ErrorDeMonto } from '../src/dinero.js';

describe('Artículo III — el dinero es un entero en la unidad mínima', () => {
  it('acepta enteros seguros no negativos', () => {
    expect(minor(33334)).toBe(33334);
    expect(minor(0)).toBe(0);
    expect(CERO).toBe(0);
  });

  it('rechaza decimales: un monto fraccionario no existe (T-010)', () => {
    expect(() => minor(1.5)).toThrow(ErrorDeMonto);
    expect(() => minor(0.1 + 0.2)).toThrow(ErrorDeMonto);
  });

  it('rechaza negativos (INV-04)', () => {
    expect(() => minor(-1)).toThrow(ErrorDeMonto);
  });

  it('rechaza lo que no es un entero seguro', () => {
    expect(() => minor(Number.NaN)).toThrow(ErrorDeMonto);
    expect(() => minor(Number.POSITIVE_INFINITY)).toThrow(ErrorDeMonto);
    expect(() => minor(2 ** 53)).toThrow(ErrorDeMonto);
  });

  it('suma, resta saturada y comparaciones se mantienen enteras', () => {
    expect(sumar(minor(10), minor(20), minor(5))).toBe(35);
    expect(sumar()).toBe(0);
    expect(restarSinBajarDeCero(minor(10), minor(30))).toBe(0);
    expect(diferencia(minor(10), minor(30))).toBe(-20);
    expect(minimo(minor(10), minor(30))).toBe(10);
    expect(positivo(-20)).toBe(0);
    expect(negativo(-20)).toBe(20);
  });
});
