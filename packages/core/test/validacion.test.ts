import { describe, expect, it } from 'vitest';
import type { Involucrado } from '../src/tipos.js';
import { validarAporte, validarObjetivo, type BorradorObjetivo } from '../src/validacion.js';

function iguales(...ids: string[]): Involucrado[] {
  return ids.map((miembroId, orden) => ({ miembroId, tipoParte: 'IGUAL' as const, valorParte: 0, orden }));
}

function borrador(parcial: Partial<BorradorObjetivo> = {}): BorradorObjetivo {
  return {
    nombre: 'Nevera',
    montoTotal: 1_200_000,
    modalidad: 'REPARTO_UNICO',
    periodicidad: null,
    fechaInicio: null,
    fechaLimite: null,
    involucrados: iguales('ana', 'luis'),
    ...parcial,
  };
}

const codigos = (b: BorradorObjetivo) => validarObjetivo(b).map((p) => p.codigo);

describe('RF-07 — validar el reparto antes de guardar', () => {
  it('un objetivo bien formado no tiene problemas', () => {
    expect(validarObjetivo(borrador())).toEqual([]);
  });

  it('CB-01 — un solo involucrado es válido', () => {
    expect(validarObjetivo(borrador({ involucrados: iguales('ana') }))).toEqual([]);
  });

  it('CB-02 — un objetivo sin involucrados no se puede guardar', () => {
    expect(codigos(borrador({ involucrados: [] }))).toContain('SIN_INVOLUCRADOS');
  });

  it('CB-03 — monto total en cero o negativo es inválido', () => {
    expect(codigos(borrador({ montoTotal: 0 }))).toContain('MONTO_INVALIDO');
    expect(codigos(borrador({ montoTotal: -5 }))).toContain('MONTO_INVALIDO');
    expect(codigos(borrador({ montoTotal: 1_200_000.5 }))).toContain('MONTO_INVALIDO');
  });

  it('devuelve todos los problemas de una vez, no solo el primero', () => {
    const problemas = validarObjetivo(borrador({ nombre: '  ', montoTotal: 0, involucrados: [] }));
    expect(problemas.map((p) => p.codigo).sort()).toEqual(['MONTO_INVALIDO', 'NOMBRE_VACIO', 'SIN_INVOLUCRADOS']);
  });

  it('rechaza a la misma persona involucrada dos veces', () => {
    expect(codigos(borrador({ involucrados: iguales('ana', 'ana') }))).toContain('INVOLUCRADO_REPETIDO');
  });

  it('cada problema dice en qué campo está, para poder señalarlo en el formulario', () => {
    expect(validarObjetivo(borrador({ montoTotal: 0 }))[0]?.campo).toBe('montoTotal');
  });
});

describe('RN-05 — generación de periodos', () => {
  const cuotas = (parcial: Partial<BorradorObjetivo> = {}) =>
    borrador({
      modalidad: 'CUOTAS_PERIODICAS',
      periodicidad: 'MENSUAL',
      fechaInicio: '2026-09-05',
      fechaLimite: '2026-12-05',
      ...parcial,
    });

  it('un objetivo de cuotas bien formado es válido', () => {
    expect(validarObjetivo(cuotas())).toEqual([]);
  });

  it('rechaza una fecha límite anterior a la de inicio', () => {
    expect(codigos(cuotas({ fechaLimite: '2026-08-05' }))).toContain('LIMITE_ANTERIOR_A_INICIO');
  });

  it('exige inicio y límite', () => {
    expect(codigos(cuotas({ fechaInicio: null }))).toContain('FECHA_INVALIDA');
    expect(codigos(cuotas({ fechaLimite: null }))).toContain('FECHA_INVALIDA');
  });

  it('rechaza fechas que no existen', () => {
    expect(codigos(cuotas({ fechaInicio: '2026-02-30' }))).toContain('FECHA_INVALIDA');
  });

  it('PA-01 — la única periodicidad disponible es la mensual', () => {
    expect(codigos(cuotas({ periodicidad: null }))).toContain('PERIODICIDAD_NO_SOPORTADA');
  });

  it('un objetivo de reparto único no lleva fecha de inicio ni periodicidad', () => {
    expect(codigos(borrador({ fechaInicio: '2026-09-05' }))).toContain('INICIO_SIN_CUOTAS');
    expect(codigos(borrador({ periodicidad: 'MENSUAL' }))).toContain('PERIODICIDAD_SIN_CUOTAS');
  });
});

describe('RF-09 — registrar un aporte', () => {
  const contexto = { involucrados: ['ana', 'luis'], miembrosDelGrupo: ['ana', 'luis', 'papa'], nPeriodos: 0 };
  const aporte = (parcial: Record<string, unknown> = {}) => ({
    monto: 33_334,
    fechaValor: '2026-09-10',
    acreditadoA: 'ana',
    pagadoPor: 'ana',
    periodoIndice: null,
    registradoPor: 'Ana',
    ...parcial,
  });

  it('un aporte bien formado no tiene problemas', () => {
    expect(validarAporte(aporte(), contexto)).toEqual([]);
  });

  it('CB-04 — un aporte de monto cero o negativo es inválido; para revertir se anula', () => {
    expect(validarAporte(aporte({ monto: 0 }), contexto)[0]?.codigo).toBe('MONTO_INVALIDO');
    expect(validarAporte(aporte({ monto: -1_000 }), contexto)[0]?.codigo).toBe('MONTO_INVALIDO');
  });

  it('CB-05 — un aporte con fecha anterior a la creación del objetivo es válido', () => {
    expect(validarAporte(aporte({ fechaValor: '2020-01-01' }), contexto)).toEqual([]);
  });

  it('CB-06 — un aporte con fecha futura es válido', () => {
    expect(validarAporte(aporte({ fechaValor: '2099-01-01' }), contexto)).toEqual([]);
  });

  it('INV-06 — solo se acredita a alguien involucrado en el objetivo', () => {
    expect(validarAporte(aporte({ acreditadoA: 'papa' }), contexto)[0]?.codigo).toBe(
      'ACREDITADO_NO_INVOLUCRADO',
    );
  });

  it('INV-06 — quien paga puede no estar involucrado, pero sí debe ser del grupo (RN-15)', () => {
    expect(validarAporte(aporte({ pagadoPor: 'papa' }), contexto)).toEqual([]);
    expect(validarAporte(aporte({ pagadoPor: 'vecino' }), contexto)[0]?.codigo).toBe('PAGADOR_NO_ES_MIEMBRO');
  });

  it('rechaza un periodo en un objetivo que no tiene cuotas', () => {
    expect(validarAporte(aporte({ periodoIndice: 0 }), contexto)[0]?.codigo).toBe(
      'PERIODO_EN_OBJETIVO_SIN_CUOTAS',
    );
  });

  it('rechaza un periodo fuera del rango del calendario', () => {
    const conCuotas = { ...contexto, nPeriodos: 3 };
    expect(validarAporte(aporte({ periodoIndice: 3 }), conCuotas)[0]?.codigo).toBe('PERIODO_FUERA_DE_RANGO');
    expect(validarAporte(aporte({ periodoIndice: 2 }), conCuotas)).toEqual([]);
  });

  it('exige decir quién registra, aclarando que no es autenticación (RN-17)', () => {
    expect(validarAporte(aporte({ registradoPor: '   ' }), contexto)[0]?.codigo).toBe('REGISTRADO_POR_VACIO');
  });
});
