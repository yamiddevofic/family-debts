import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { minor } from '../src/dinero.js';
import { ErrorDeReparto, repartir, repartirEnPeriodos, repartirPorPesos } from '../src/reparto.js';
import type { Involucrado } from '../src/tipos.js';

function iguales(...ids: string[]): Involucrado[] {
  return ids.map((miembroId, orden) => ({ miembroId, tipoParte: 'IGUAL' as const, valorParte: 0, orden }));
}

describe('RN-01 — reparto por partes iguales', () => {
  it('$100.000 entre Ana, Luis y Sara da 33.334 / 33.333 / 33.333', () => {
    const partes = repartir(minor(100_000), iguales('ana', 'luis', 'sara'));
    expect(partes.map((p) => p.montoDebido)).toEqual([33_334, 33_333, 33_333]);
  });

  it('la suma de las partes es exactamente el total (INV-02)', () => {
    const partes = repartir(minor(100_000), iguales('ana', 'luis', 'sara'));
    expect(partes.reduce((total, p) => total + p.montoDebido, 0)).toBe(100_000);
  });

  it('un reparto exacto no produce residuo', () => {
    const partes = repartir(minor(1_200_000), iguales('a', 'b', 'c', 'd'));
    expect(partes.map((p) => p.montoDebido)).toEqual([300_000, 300_000, 300_000, 300_000]);
  });

  it('CB-01 — un solo involucrado se lleva el total, sin residuo', () => {
    const partes = repartir(minor(100_000), iguales('ana'));
    expect(partes).toEqual([{ miembroId: 'ana', montoDebido: 100_000 }]);
  });

  it('CB-02 — sin involucrados no hay reparto posible', () => {
    expect(() => repartir(minor(100_000), [])).toThrow(ErrorDeReparto);
  });

  it('los porcentajes y montos fijos se rechazan explícitamente hasta el Incremento 4', () => {
    const involucrados: Involucrado[] = [
      { miembroId: 'ana', tipoParte: 'PORCENTAJE', valorParte: 5_000, orden: 0 },
      { miembroId: 'luis', tipoParte: 'PORCENTAJE', valorParte: 5_000, orden: 1 },
    ];
    expect(() => repartir(minor(1_000), involucrados)).toThrow(/Incremento 4/);
  });
});

describe('RN-04 — distribución determinista del residuo', () => {
  it('el residuo va a quien tiene mayor resto, y desempata el menor orden', () => {
    // Tres partes iguales de 100.000: todos tienen el mismo resto, así que manda `orden`.
    const partes = repartir(minor(100_000), iguales('sara', 'ana', 'luis'));
    expect(partes[0]).toEqual({ miembroId: 'sara', montoDebido: 33_334 });
    expect(partes[1]?.montoDebido).toBe(33_333);
  });

  it('el mismo conjunto reparte igual sin importar el orden del arreglo de entrada', () => {
    const definidos = iguales('ana', 'luis', 'sara');
    const alReves = [...definidos].reverse();
    const a = new Map(repartir(minor(100_000), definidos).map((p) => [p.miembroId, p.montoDebido]));
    const b = new Map(repartir(minor(100_000), alReves).map((p) => [p.miembroId, p.montoDebido]));
    expect(a).toEqual(b);
  });

  it('es reproducible: mil ejecuciones dan exactamente el mismo resultado', () => {
    const esperado = repartir(minor(100_001), iguales('a', 'b', 'c', 'd', 'e', 'f', 'g'));
    for (let i = 0; i < 1_000; i += 1) {
      expect(repartir(minor(100_001), iguales('a', 'b', 'c', 'd', 'e', 'f', 'g'))).toEqual(esperado);
    }
  });

  it('reparte a lo sumo una unidad extra por participante', () => {
    const partes = repartir(minor(10), iguales('a', 'b', 'c'));
    expect(partes.map((p) => p.montoDebido)).toEqual([4, 3, 3]);
  });

  it('con pesos desiguales aplica el mayor resto sobre la parte proporcional', () => {
    // Base del reparto por porcentajes (RN-02), que llega en el Incremento 4.
    const asignado = repartirPorPesos(minor(1_000), [
      { clave: 'ana', peso: 3_333, orden: 0 },
      { clave: 'luis', peso: 3_333, orden: 1 },
      { clave: 'sara', peso: 3_334, orden: 2 },
    ]);
    expect([...asignado.values()]).toEqual([333, 333, 334]);
  });

  it('un total de cero reparte cero a todos', () => {
    expect(repartir(minor(0), iguales('a', 'b')).map((p) => p.montoDebido)).toEqual([0, 0]);
  });
});

describe('INV-02 — la suma de las partes iguala el total, para toda entrada válida', () => {
  it('se sostiene sobre montos y números de involucrados generados al azar (DT-13)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5_000_000_000 }),
        fc.integer({ min: 1, max: 40 }),
        (total, cuantos) => {
          const involucrados = iguales(...Array.from({ length: cuantos }, (_, i) => `m${String(i)}`));
          const partes = repartir(minor(total), involucrados);
          const suma = partes.reduce((acumulado, p) => acumulado + p.montoDebido, 0);
          // La suma cuadra al peso y nadie recibe una parte negativa.
          return suma === total && partes.every((p) => p.montoDebido >= 0);
        },
      ),
      { numRuns: 1_000 },
    );
  });

  it('la diferencia entre la parte mayor y la menor nunca pasa de una unidad', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.integer({ min: 1, max: 30 }),
        (total, cuantos) => {
          const partes = repartir(
            minor(total),
            iguales(...Array.from({ length: cuantos }, (_, i) => `m${String(i)}`)),
          ).map((p) => p.montoDebido);
          return Math.max(...partes) - Math.min(...partes) <= 1;
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe('RN-06 — reparto de la obligación entre periodos', () => {
  it('$100.000 en 3 periodos da 33.334 / 33.333 / 33.333: los tempranos cargan el extra', () => {
    expect(repartirEnPeriodos(minor(100_000), 3)).toEqual([33_334, 33_333, 33_333]);
  });

  it('un solo periodo se lleva toda la obligación (CB-09)', () => {
    expect(repartirEnPeriodos(minor(100_000), 1)).toEqual([100_000]);
  });

  it('rechaza un número de periodos que no existe', () => {
    expect(() => repartirEnPeriodos(minor(100_000), 0)).toThrow(ErrorDeReparto);
    expect(() => repartirEnPeriodos(minor(100_000), -3)).toThrow(ErrorDeReparto);
  });
});

describe('INV-03 — la suma de las cuotas iguala la obligación total del involucrado', () => {
  it('se sostiene sobre obligaciones y calendarios generados al azar (DT-13)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2_000_000_000 }),
        fc.integer({ min: 1, max: 60 }),
        (obligacion, nPeriodos) => {
          const cuotas = repartirEnPeriodos(minor(obligacion), nPeriodos);
          return cuotas.reduce((total, c) => total + c, 0) === obligacion && cuotas.length === nPeriodos;
        },
      ),
      { numRuns: 1_000 },
    );
  });

  it('INV-02 e INV-03 se componen: partes por periodo suman el total del objetivo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000_000 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 12 }),
        (total, cuantos, nPeriodos) => {
          const partes = repartir(
            minor(total),
            iguales(...Array.from({ length: cuantos }, (_, i) => `m${String(i)}`)),
          );
          const suma = partes
            .flatMap((p) => repartirEnPeriodos(p.montoDebido, nPeriodos))
            .reduce((acumulado, c) => acumulado + c, 0);
          return suma === total;
        },
      ),
      { numRuns: 500 },
    );
  });
});
