import { describe, expect, it } from 'vitest';
import { ErrorDeFecha, comparar, esBisiesto, fechaCivil, sumarMeses, ultimoDiaDelMes } from '../src/fecha.js';

describe('DT-11 — las fechas civiles son cadenas AAAA-MM-DD', () => {
  it('acepta una fecha bien formada y real', () => {
    expect(fechaCivil('2026-12-05')).toBe('2026-12-05');
  });

  it('rechaza formatos que no son AAAA-MM-DD', () => {
    expect(() => fechaCivil('05-12-2026')).toThrow(ErrorDeFecha);
    expect(() => fechaCivil('2026-12-5')).toThrow(ErrorDeFecha);
    expect(() => fechaCivil('')).toThrow(ErrorDeFecha);
  });

  it('rechaza fechas que no existen', () => {
    expect(() => fechaCivil('2026-02-30')).toThrow(ErrorDeFecha);
    expect(() => fechaCivil('2026-13-01')).toThrow(ErrorDeFecha);
    expect(() => fechaCivil('2025-02-29')).toThrow(ErrorDeFecha);
  });

  it('acepta el 29 de febrero solo en año bisiesto', () => {
    expect(esBisiesto(2024)).toBe(true);
    expect(esBisiesto(2100)).toBe(false);
    expect(esBisiesto(2000)).toBe(true);
    expect(fechaCivil('2024-02-29')).toBe('2024-02-29');
    expect(ultimoDiaDelMes(2024, 2)).toBe(29);
    expect(ultimoDiaDelMes(2026, 2)).toBe(28);
  });

  it('el orden lexicográfico es el orden cronológico, que es para lo que se eligió ISO', () => {
    expect(comparar(fechaCivil('2026-01-10'), fechaCivil('2026-12-05'))).toBeLessThan(0);
    expect(['2026-12-05', '2026-01-10'].sort()).toEqual(['2026-01-10', '2026-12-05']);
  });

  it('sumarMeses conserva el día de origen y lo recorta solo cuando no existe', () => {
    expect(sumarMeses(fechaCivil('2026-09-05'), 3)).toBe('2026-12-05');
    expect(sumarMeses(fechaCivil('2026-01-31'), 1)).toBe('2026-02-28');
    expect(sumarMeses(fechaCivil('2024-01-31'), 1)).toBe('2024-02-29');
    // El recorte no se arrastra: de enero 31 a marzo se vuelve al 31.
    expect(sumarMeses(fechaCivil('2026-01-31'), 2)).toBe('2026-03-31');
    expect(sumarMeses(fechaCivil('2026-11-15'), 2)).toBe('2027-01-15');
  });
});
