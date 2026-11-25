import { describe, expect, it } from 'vitest';
import { ErrorDeCalendario, generarPeriodos } from '../src/calendario.js';
import { fechaCivil } from '../src/fecha.js';

const f = fechaCivil;
const vencimientos = (inicio: string, limite: string) =>
  generarPeriodos(f(inicio), f(limite)).map((p) => p.fechaVencimiento);

describe('RN-05 — generación de periodos', () => {
  it('del 2026-09-05 al 2026-12-05 salen 4 periodos, ambas fechas incluidas', () => {
    expect(vencimientos('2026-09-05', '2026-12-05')).toEqual([
      '2026-09-05',
      '2026-10-05',
      '2026-11-05',
      '2026-12-05',
    ]);
  });

  it('los índices son consecutivos desde cero', () => {
    expect(generarPeriodos(f('2026-09-05'), f('2026-12-05')).map((p) => p.indice)).toEqual([0, 1, 2, 3]);
  });

  it('desbordamiento de día: del 31 de enero se pasa al último día de cada mes corto', () => {
    expect(vencimientos('2026-01-31', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('desbordamiento de día en año bisiesto', () => {
    expect(vencimientos('2024-01-31', '2024-03-31')).toEqual(['2024-01-31', '2024-02-29', '2024-03-31']);
  });

  it('el día 30 tampoco se arrastra al pasar por febrero', () => {
    expect(vencimientos('2026-01-30', '2026-03-30')).toEqual(['2026-01-30', '2026-02-28', '2026-03-30']);
  });

  it('CB-09 — inicio y límite en el mismo mes dan exactamente un periodo', () => {
    expect(vencimientos('2026-09-05', '2026-09-20')).toEqual(['2026-09-05']);
    expect(vencimientos('2026-09-05', '2026-09-05')).toEqual(['2026-09-05']);
  });

  it('el último vencimiento nunca pasa de la fecha límite', () => {
    expect(vencimientos('2026-09-05', '2026-12-03')).toEqual(['2026-09-05', '2026-10-05', '2026-11-05']);
  });

  it('una fecha límite anterior a la de inicio hace inválido el objetivo', () => {
    expect(() => generarPeriodos(f('2026-12-05'), f('2026-09-05'))).toThrow(ErrorDeCalendario);
  });

  it('cruza el cambio de año sin saltarse meses', () => {
    expect(vencimientos('2026-11-15', '2027-02-15')).toEqual([
      '2026-11-15',
      '2026-12-15',
      '2027-01-15',
      '2027-02-15',
    ]);
  });
});
