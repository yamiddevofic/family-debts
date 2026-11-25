import { describe, expect, it } from 'vitest';
import { minor } from '../src/dinero.js';
import { fechaCivil } from '../src/fecha.js';
import { imputar, type AporteImputable } from '../src/imputacion.js';

const cuotas = [minor(33_334), minor(33_333), minor(33_333)];

function aporte(id: string, monto: number, periodoIndice: number | null = null, fecha = '2026-09-10'): AporteImputable {
  return {
    id,
    monto: minor(monto),
    periodoIndice,
    fechaValor: fechaCivil(fecha),
    registradoEn: `2026-09-10T10:00:00.000Z`,
  };
}

describe('RN-08 — imputación de un aporte a los periodos', () => {
  it('un aporte sin periodo salda el más antiguo y el excedente cae en cascada', () => {
    const { periodos, aFavor } = imputar(cuotas, [aporte('a1', 50_000)]);
    expect(periodos.map((p) => p.aplicado)).toEqual([33_334, 16_666, 0]);
    expect(periodos.map((p) => p.pendiente)).toEqual([0, 16_667, 33_333]);
    expect(aFavor).toBe(0);
  });

  it('varios aportes libres se acumulan en orden de antigüedad', () => {
    const { periodos } = imputar(cuotas, [
      aporte('a2', 20_000, null, '2026-10-01'),
      aporte('a1', 33_334, null, '2026-09-10'),
    ]);
    expect(periodos.map((p) => p.aplicado)).toEqual([33_334, 20_000, 0]);
  });

  it('un aporte con periodo indicado se queda allí aunque genere excedente en ese periodo', () => {
    const { periodos, aFavor } = imputar(cuotas, [aporte('a1', 50_000, 1)]);
    expect(periodos[1]?.aplicado).toBe(50_000);
    expect(periodos[1]?.aFavor).toBe(16_667);
    expect(periodos[0]?.pendiente).toBe(33_334);
    expect(periodos[2]?.pendiente).toBe(33_333);
    expect(aFavor).toBe(0);
  });

  it('los dirigidos se aplican antes, y la cascada de los libres ve el estado real', () => {
    const { periodos } = imputar(cuotas, [aporte('dirigido', 33_333, 2), aporte('libre', 40_000)]);
    expect(periodos.map((p) => p.pendiente)).toEqual([0, 26_667, 0]);
  });

  it('la imputación es derivada: quitar un aporte recalcula todo, no migra nada', () => {
    const todos = [aporte('a1', 33_334), aporte('a2', 33_333, null, '2026-10-10')];
    expect(imputar(cuotas, todos).periodos.map((p) => p.pendiente)).toEqual([0, 0, 33_333]);
    expect(imputar(cuotas, [todos[1] as AporteImputable]).periodos.map((p) => p.pendiente)).toEqual([
      1, 33_333, 33_333,
    ]);
  });

  it('el desglose deja ver qué parte de cada aporte cubrió cada periodo (RF-15)', () => {
    const { periodos } = imputar(cuotas, [aporte('a1', 50_000)]);
    expect(periodos[0]?.aportes).toEqual([{ aporteId: 'a1', monto: 33_334 }]);
    expect(periodos[1]?.aportes).toEqual([{ aporteId: 'a1', monto: 16_666 }]);
  });

  it('sin aportes, cada periodo queda pendiente por su cuota entera', () => {
    const { periodos } = imputar(cuotas, []);
    expect(periodos.map((p) => p.pendiente)).toEqual([33_334, 33_333, 33_333]);
  });

  it('lo aplicado más lo pendiente nunca deja de cuadrar con la cuota', () => {
    const { periodos } = imputar(cuotas, [aporte('a1', 40_000), aporte('a2', 10_000, 2, '2026-11-01')]);
    for (const p of periodos) {
      expect(Math.min(p.aplicado, p.cuota) + p.pendiente).toBe(p.cuota);
    }
  });
});

describe('RN-09 — excedente y saldo a favor', () => {
  it('lo que no cabe en ningún periodo queda como saldo a favor, no se pierde', () => {
    const { periodos, aFavor } = imputar(cuotas, [aporte('a1', 120_000)]);
    expect(periodos.every((p) => p.pendiente === 0)).toBe(true);
    expect(aFavor).toBe(20_000);
  });

  it('un aporte dirigido a un periodo que ya no existe queda como saldo a favor', () => {
    const { aFavor } = imputar(cuotas, [aporte('a1', 5_000, 7)]);
    expect(aFavor).toBe(5_000);
  });
});
