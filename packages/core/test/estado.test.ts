import { describe, expect, it } from 'vitest';
import { estadoGrupo, estadoObjetivo } from '../src/estado.js';
import { fechaCivil } from '../src/fecha.js';
import { ANULADO, GRUPO, HOY, aporte, miembro, objetivo } from './ayudas.js';

describe('RN-07 — cálculo del saldo', () => {
  const base = objetivo({ montoTotal: 100_000, involucrados: ['ana', 'luis', 'sara'] });

  it('aportado es la suma de los aportes no anulados acreditados a la persona', () => {
    const estado = estadoObjetivo(base, [aporte({ acreditadoA: 'ana', monto: 20_000 })], HOY);
    expect(estado.involucrados[0]?.aportado).toBe(20_000);
    expect(estado.involucrados[1]?.aportado).toBe(0);
  });

  it('saldo es obligación menos aportado: positivo es deuda', () => {
    const estado = estadoObjetivo(base, [aporte({ acreditadoA: 'ana', monto: 20_000 })], HOY);
    const ana = estado.involucrados[0];
    expect(ana?.obligacion).toBe(33_334);
    expect(ana?.saldo).toBe(13_334);
    expect(ana?.debe).toBe(13_334);
    expect(ana?.aFavor).toBe(0);
  });

  it('faltante del objetivo es la suma de los saldos positivos', () => {
    const estado = estadoObjetivo(base, [aporte({ acreditadoA: 'ana', monto: 33_334 })], HOY);
    expect(estado.faltante).toBe(66_666);
  });

  it('recaudado es la suma de todos los aportes no anulados del objetivo', () => {
    const estado = estadoObjetivo(
      base,
      [aporte({ acreditadoA: 'ana', monto: 33_334 }), aporte({ acreditadoA: 'luis', monto: 10_000 })],
      HOY,
    );
    expect(estado.recaudado).toBe(43_334);
  });

  it('recaudado y montoTotal − faltante pueden diferir con saldo a favor, y ambos se muestran', () => {
    const estado = estadoObjetivo(base, [aporte({ acreditadoA: 'ana', monto: 50_000 })], HOY);
    expect(estado.recaudado).toBe(50_000);
    expect(estado.montoTotal - estado.faltante).toBe(33_334);
    expect(estado.aFavorTotal).toBe(16_666);
  });

  it('la obligación de todos los involucrados suma el monto total (INV-02)', () => {
    const estado = estadoObjetivo(base, [], HOY);
    expect(estado.involucrados.reduce((t, i) => t + i.obligacion, 0)).toBe(100_000);
  });
});

describe('RN-09 — excedente y saldo a favor', () => {
  const base = objetivo({ montoTotal: 100_000, involucrados: ['ana', 'luis', 'sara'] });

  it('un aporte mayor a la obligación se acepta y produce saldo a favor en ese objetivo', () => {
    const estado = estadoObjetivo(base, [aporte({ acreditadoA: 'ana', monto: 45_334 })], HOY);
    expect(estado.involucrados[0]?.aFavor).toBe(12_000);
    expect(estado.involucrados[0]?.debe).toBe(0);
  });

  it('el saldo a favor no se traslada a otro objetivo ni se vuelve deuda de nadie (PA-02)', () => {
    const nevera = objetivo({ id: 'o1', montoTotal: 100_000, involucrados: ['ana', 'luis'] });
    const techo = objetivo({ id: 'o2', nombre: 'Techo', montoTotal: 60_000, involucrados: ['ana', 'luis'] });
    const estado = estadoGrupo(
      GRUPO,
      [miembro('ana'), miembro('luis')],
      [nevera, techo],
      [aporte({ objetivoId: 'o1', acreditadoA: 'ana', monto: 60_000 })],
      HOY,
    );
    const ana = estado.porMiembro[0];
    expect(ana?.aFavorTotal).toBe(10_000);
    expect(ana?.objetivos.find((o) => o.objetivoId === 'o2')?.debe).toBe(30_000);
    expect(estado.porMiembro[1]?.debeTotal).toBe(80_000);
  });
});

describe('RN-10 — objetivo saldado', () => {
  const base = objetivo({ montoTotal: 100_000, involucrados: ['ana', 'luis', 'sara'] });

  it('está saldado cuando ningún involucrado tiene saldo positivo, sin escribir ningún estado', () => {
    const estado = estadoObjetivo(
      base,
      [
        aporte({ acreditadoA: 'ana', monto: 33_334 }),
        aporte({ acreditadoA: 'luis', monto: 33_333 }),
        aporte({ acreditadoA: 'sara', monto: 33_333 }),
      ],
      HOY,
    );
    expect(estado.saldado).toBe(true);
    expect(estado.estado).toBe('ACTIVO');
  });

  it('no está saldado si a alguien le falta un solo peso', () => {
    const estado = estadoObjetivo(
      base,
      [
        aporte({ acreditadoA: 'ana', monto: 33_333 }),
        aporte({ acreditadoA: 'luis', monto: 33_333 }),
        aporte({ acreditadoA: 'sara', monto: 33_333 }),
      ],
      HOY,
    );
    expect(estado.saldado).toBe(false);
    expect(estado.faltante).toBe(1);
  });

  it('CB-10 — si se anulan todos los aportes vuelve a recaudado 0 y deja de estar saldado', () => {
    const aportes = [
      aporte({ acreditadoA: 'ana', monto: 33_334, anulacion: ANULADO }),
      aporte({ acreditadoA: 'luis', monto: 33_333, anulacion: ANULADO }),
      aporte({ acreditadoA: 'sara', monto: 33_333, anulacion: ANULADO }),
    ];
    const estado = estadoObjetivo(base, aportes, HOY);
    expect(estado.recaudado).toBe(0);
    expect(estado.saldado).toBe(false);
    expect(estado.aportes).toHaveLength(3);
  });
});

describe('RN-13 — anulación de aportes', () => {
  const base = objetivo({ montoTotal: 100_000, involucrados: ['ana', 'luis', 'sara'] });

  it('INV-05 — un aporte anulado no altera ningún saldo pero sigue en el historial', () => {
    const estado = estadoObjetivo(
      base,
      [
        aporte({ id: 'bueno', acreditadoA: 'ana', monto: 33_334 }),
        aporte({ id: 'errado', acreditadoA: 'ana', monto: 99_000, anulacion: ANULADO }),
      ],
      HOY,
    );
    expect(estado.involucrados[0]?.aportado).toBe(33_334);
    expect(estado.involucrados[0]?.saldo).toBe(0);
    expect(estado.aportes.map((a) => a.aporteId)).toContain('errado');
    expect(estado.aportes.find((a) => a.aporteId === 'errado')?.anulado).toBe(true);
  });

  it('el historial conserva el motivo de la anulación, no solo la marca', () => {
    const estado = estadoObjetivo(
      base,
      [aporte({ id: 'errado', acreditadoA: 'ana', monto: 99_000, anulacion: ANULADO })],
      HOY,
    );
    expect(estado.aportes[0]?.motivoAnulacion).toBe('Monto equivocado');
  });
});

describe('RN-15 — pago por cuenta de otro', () => {
  const base = objetivo({ montoTotal: 100_000, involucrados: ['ana', 'luis', 'sara'] });

  it('baja el saldo de quien se acredita, no el de quien pagó', () => {
    const estado = estadoObjetivo(
      base,
      [aporte({ acreditadoA: 'sara', pagadoPor: 'papa', monto: 33_333 })],
      HOY,
    );
    const sara = estado.involucrados.find((i) => i.miembroId === 'sara');
    const ana = estado.involucrados.find((i) => i.miembroId === 'ana');
    expect(sara?.saldo).toBe(0);
    expect(ana?.saldo).toBe(33_334);
  });

  it('no crea ninguna deuda de Sara hacia papá: eso está fuera de alcance (§3.2)', () => {
    const estado = estadoGrupo(
      GRUPO,
      [miembro('ana'), miembro('luis'), miembro('sara'), miembro('papa')],
      [base],
      [aporte({ acreditadoA: 'sara', pagadoPor: 'papa', monto: 33_333 })],
      HOY,
    );
    const papa = estado.porMiembro.find((m) => m.miembroId === 'papa');
    expect(papa?.debeTotal).toBe(0);
    expect(papa?.aFavorTotal).toBe(0);
    expect(papa?.objetivos).toEqual([]);
  });

  it('el hecho queda registrado y visible en el desglose (Artículo V)', () => {
    const estado = estadoObjetivo(
      base,
      [aporte({ acreditadoA: 'sara', pagadoPor: 'papa', monto: 33_333 })],
      HOY,
    );
    const linea = estado.aportes[0];
    expect(linea?.pagadoPor).toBe('papa');
    expect(linea?.acreditadoA).toBe('sara');
    expect(linea?.porCuentaDeOtro).toBe(true);
  });
});

describe('RN-12 — mora', () => {
  const cuotas = objetivo({
    montoTotal: 90_000,
    involucrados: ['ana', 'luis', 'sara'],
    modalidad: 'CUOTAS_PERIODICAS',
    fechaInicio: fechaCivil('2026-09-05'),
    fechaLimite: fechaCivil('2026-11-05'),
  });

  it('un periodo vencido con saldo pendiente está en mora, y su miembro también', () => {
    const estado = estadoObjetivo(cuotas, [], fechaCivil('2026-10-15'));
    const ana = estado.involucrados[0];
    expect(ana?.periodos[0]?.enMora).toBe(true);
    expect(ana?.periodos[1]?.enMora).toBe(true);
    expect(ana?.periodos[2]?.enMora).toBe(false);
    expect(ana?.enMora).toBe(true);
    expect(estado.enMora).toBe(true);
  });

  it('un periodo vencido y pagado no está en mora, pero el siguiente vencido sí', () => {
    // Cuota de Ana: 10.000 por periodo. Con 10.000 cubre el primero y nada más.
    const estado = estadoObjetivo(
      cuotas,
      [aporte({ acreditadoA: 'ana', monto: 10_000, fechaValor: '2026-09-06' })],
      fechaCivil('2026-10-15'),
    );
    const ana = estado.involucrados[0];
    expect(ana?.periodos[0]?.pendiente).toBe(0);
    expect(ana?.periodos[0]?.enMora).toBe(false);
    expect(ana?.periodos[1]?.enMora).toBe(true);
  });

  it('quien va al día en todo lo vencido no está en mora, aunque le falten cuotas futuras', () => {
    const estado = estadoObjetivo(
      cuotas,
      [aporte({ acreditadoA: 'ana', monto: 20_000, fechaValor: '2026-09-06' })],
      fechaCivil('2026-10-15'),
    );
    const ana = estado.involucrados[0];
    expect(ana?.enMora).toBe(false);
    expect(ana?.periodos[2]?.pendiente).toBe(10_000);
    expect(ana?.debe).toBe(10_000);
  });

  it('la fecha de referencia es un parámetro: se puede preguntar por el pasado', () => {
    expect(estadoObjetivo(cuotas, [], fechaCivil('2026-09-01')).enMora).toBe(false);
    expect(estadoObjetivo(cuotas, [], fechaCivil('2026-12-01')).enMora).toBe(true);
  });

  it('el mismo día del vencimiento todavía no es mora', () => {
    expect(estadoObjetivo(cuotas, [], fechaCivil('2026-09-05')).enMora).toBe(false);
    expect(estadoObjetivo(cuotas, [], fechaCivil('2026-09-06')).enMora).toBe(true);
  });

  it('CB-06 — un aporte con fecha futura no rescata un periodo ya vencido', () => {
    const estado = estadoObjetivo(
      cuotas,
      [aporte({ acreditadoA: 'ana', monto: 30_000, fechaValor: '2026-12-20' })],
      fechaCivil('2026-10-15'),
    );
    const ana = estado.involucrados[0];
    expect(ana?.periodos[0]?.enMora).toBe(true);
    expect(ana?.aportado).toBe(30_000);
    expect(estado.aportes[0]?.futuro).toBe(true);
  });

  it('un reparto único sin fecha límite no genera mora nunca', () => {
    const sinLimite = objetivo({ montoTotal: 100_000, involucrados: ['ana', 'luis'] });
    expect(estadoObjetivo(sinLimite, [], fechaCivil('2030-01-01')).enMora).toBe(false);
  });

  it('un reparto único con fecha límite pasada y saldo pendiente sí entra en mora', () => {
    const conLimite = objetivo({
      montoTotal: 100_000,
      involucrados: ['ana', 'luis'],
      fechaLimite: fechaCivil('2026-09-30'),
    });
    expect(estadoObjetivo(conLimite, [], fechaCivil('2026-09-29')).enMora).toBe(false);
    expect(estadoObjetivo(conLimite, [], fechaCivil('2026-10-01')).enMora).toBe(true);
    const pagado = [
      aporte({ acreditadoA: 'ana', monto: 50_000 }),
      aporte({ acreditadoA: 'luis', monto: 50_000 }),
    ];
    expect(estadoObjetivo(conLimite, pagado, fechaCivil('2026-10-01')).enMora).toBe(false);
  });
});

describe('CB-12 — miembro inactivo con obligación pendiente', () => {
  it('sigue debiendo y sigue visible: desactivar no perdona deudas', () => {
    const base = objetivo({ montoTotal: 100_000, involucrados: ['ana', 'luis'] });
    const estado = estadoGrupo(GRUPO, [miembro('ana'), miembro('luis', 'Luis', false)], [base], [], HOY);
    const luis = estado.porMiembro.find((m) => m.miembroId === 'luis');
    expect(luis?.debeTotal).toBe(50_000);
    expect(estado.objetivos[0]?.involucrados.map((i) => i.miembroId)).toContain('luis');
  });
});

describe('HU-06 — ver el estado de un vistazo', () => {
  it('el tablero trae por objetivo lo necesario, lo recaudado y lo que falta', () => {
    const nevera = objetivo({ id: 'o1', montoTotal: 100_000, involucrados: ['ana', 'luis'] });
    const techo = objetivo({ id: 'o2', nombre: 'Techo', montoTotal: 60_000, involucrados: ['ana'] });
    const estado = estadoGrupo(
      GRUPO,
      [miembro('ana'), miembro('luis')],
      [nevera, techo],
      [aporte({ objetivoId: 'o1', acreditadoA: 'ana', monto: 20_000 })],
      HOY,
    );
    expect(estado.totalNecesario).toBe(160_000);
    expect(estado.totalRecaudado).toBe(20_000);
    expect(estado.totalFaltante).toBe(140_000);
  });

  it('cada cifra se puede desglosar hasta los aportes que la producen (RF-15, Artículo V)', () => {
    const base = objetivo({ montoTotal: 100_000, involucrados: ['ana', 'luis'] });
    const estado = estadoObjetivo(
      base,
      [aporte({ id: 'x1', acreditadoA: 'ana', monto: 20_000 }), aporte({ id: 'x2', acreditadoA: 'ana', monto: 5_000 })],
      HOY,
    );
    const ana = estado.involucrados[0];
    expect(ana?.aportado).toBe(25_000);
    // El desglose referencia los aportes del objetivo en vez de copiarlos: la cifra se
    // sigue pudiendo abrir hasta los hechos que la producen, sin duplicar la respuesta.
    expect(ana?.desglose).toEqual(['x1', 'x2']);
    const suyos = estado.aportes.filter((a) => ana?.desglose.includes(a.aporteId));
    expect(suyos.reduce((t, d) => t + d.monto, 0)).toBe(ana?.aportado);
  });

  // Esta es la prueba de RNF-04 tal como lo escribe la spec: el estado **se calcula** en
  // menos de 100 ms. La API tiene su propio presupuesto, más holgado, porque además lee de
  // SQLite y serializa JSON, que RNF-04 no menciona.
  it('RNF-04 — 20 miembros, 100 objetivos y 2.000 aportes se calculan en menos de 100 ms', () => {
    const miembros = Array.from({ length: 20 }, (_, i) => miembro(`m${String(i)}`));
    const objetivos = Array.from({ length: 100 }, (_, i) =>
      objetivo({
        id: `o${String(i)}`,
        nombre: `Objetivo ${String(i)}`,
        montoTotal: 1_000_000 + i,
        involucrados: miembros.slice(0, 5 + (i % 15)).map((m) => m.id),
        ...(i % 3 === 0
          ? {
              modalidad: 'CUOTAS_PERIODICAS' as const,
              fechaInicio: fechaCivil('2026-01-31'),
              fechaLimite: fechaCivil('2026-12-31'),
            }
          : {}),
      }),
    );
    const aportes = Array.from({ length: 2_000 }, (_, i) =>
      aporte({
        id: `a${String(i)}`,
        objetivoId: `o${String(i % 100)}`,
        acreditadoA: `m${String(i % 5)}`,
        monto: 10_000 + i,
      }),
    );

    // Una calentada primero y luego la mediana de cinco pasadas. Una sola medición en frío
    // mezcla la compilación JIT y la contención de CPU de los demás archivos de prueba, que
    // corren en paralelo: mediría la máquina, no el algoritmo. El umbral sigue siendo el que
    // fija RNF-04.
    const estado = estadoGrupo(GRUPO, miembros, objetivos, aportes, HOY);
    expect(estado.objetivos).toHaveLength(100);

    const tiempos: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const inicio = performance.now();
      estadoGrupo(GRUPO, miembros, objetivos, aportes, HOY);
      tiempos.push(performance.now() - inicio);
    }
    tiempos.sort((a, b) => a - b);

    expect(tiempos[2] as number).toBeLessThan(100);
  });
});
