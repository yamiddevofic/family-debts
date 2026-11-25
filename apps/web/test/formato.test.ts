import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { aMesCorto, aMoneda, aTextoLargo, aVista, deTextoAMonto, deVista, porcentaje } from '../src/formato.ts';

const COP = { codigo: 'COP', exponente: 0 };
const USD = { codigo: 'USD', exponente: 2 };

describe('RNF-07 — idioma y formato', () => {
  it('T-035 — 1200000 en COP se muestra como $1.200.000, sin decimales', () => {
    expect(aMoneda(1_200_000, COP).replace(/ /g, ' ')).toBe('$ 1.200.000');
  });

  it('CB-14 — con exponente 2 la unidad mínima es el centavo', () => {
    expect(aMoneda(1_200_000, USD)).toContain('12.000,00');
  });

  it('lee de vuelta lo que una persona escribe en un campo de monto', () => {
    expect(deTextoAMonto('1.200.000', COP)).toBe(1_200_000);
    expect(deTextoAMonto('$ 1.200.000', COP)).toBe(1_200_000);
    expect(deTextoAMonto('12.000,50', USD)).toBe(1_200_050);
    expect(deTextoAMonto('', COP)).toBeNull();
    expect(deTextoAMonto('abc', COP)).toBeNull();
  });

  it('el porcentaje de avance nunca pasa de 100 ni se divide por cero', () => {
    expect(porcentaje(50, 100)).toBe(50);
    expect(porcentaje(150, 100)).toBe(100);
    expect(porcentaje(10, 0)).toBe(0);
  });
});

describe('DT-11 — las fechas se muestran en DD-MM-AAAA y se guardan en AAAA-MM-DD', () => {
  it('T-036 — convierte de ISO a la vista', () => {
    expect(aVista('2026-12-05')).toBe('05-12-2026');
    expect(aVista('2026-01-31')).toBe('31-01-2026');
  });

  it('T-036 — convierte de la vista a ISO', () => {
    expect(deVista('05-12-2026')).toBe('2026-12-05');
    expect(deVista('5-12-2026')).toBe('2026-12-05');
    expect(deVista('05/12/2026')).toBe('2026-12-05');
    expect(deVista(' 05-12-2026 ')).toBe('2026-12-05');
  });

  it('devuelve null en vez de adivinar cuando la fecha no es válida', () => {
    expect(deVista('30-02-2026')).toBeNull();
    expect(deVista('05-13-2026')).toBeNull();
    expect(deVista('2026-12-05')).toBeNull();
    expect(deVista('mañana')).toBeNull();
    expect(deVista('')).toBeNull();
  });

  it('acepta el 29 de febrero solo en año bisiesto', () => {
    expect(deVista('29-02-2024')).toBe('2024-02-29');
    expect(deVista('29-02-2026')).toBeNull();
  });

  it('T-036 — ida y vuelta sobre fechas generadas al azar', () => {
    fc.assert(
      fc.property(fc.date({ min: new Date('1970-01-01'), max: new Date('2100-12-31'), noInvalidDate: true }), (fecha) => {
        const iso = fecha.toISOString().slice(0, 10);
        return deVista(aVista(iso)) === iso;
      }),
      { numRuns: 1_000 },
    );
  });

  it('escribe la fecha larga en español para donde hay espacio', () => {
    expect(aTextoLargo('2026-12-05')).toBe('5 de diciembre de 2026');
    expect(aMesCorto('2026-12-05')).toBe('dic 2026');
  });
});
