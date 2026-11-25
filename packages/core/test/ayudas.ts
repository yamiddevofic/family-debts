import { minor } from '../src/dinero.js';
import { fechaCivil } from '../src/fecha.js';
import type { Anulacion, Aporte, Grupo, Miembro, Modalidad, Objetivo } from '../src/tipos.js';

/** Fábricas para armar escenarios en las pruebas sin repetir veinte campos cada vez. */

export const GRUPO: Grupo = {
  id: 'g1',
  nombre: 'Casa',
  moneda: { codigo: 'COP', exponente: 0 },
  creadoEn: '2026-08-01T00:00:00.000Z',
};

export function miembro(id: string, nombre = id, activo = true): Miembro {
  return { id, grupoId: 'g1', nombre, activo, creadoEn: '2026-08-01T00:00:00.000Z' };
}

export function objetivo(
  parcial: Omit<Partial<Objetivo>, 'involucrados' | 'montoTotal'> & {
    involucrados: string[];
    montoTotal: number;
  },
): Objetivo {
  const modalidad: Modalidad = parcial.modalidad ?? 'REPARTO_UNICO';
  return {
    id: parcial.id ?? 'o1',
    grupoId: 'g1',
    nombre: parcial.nombre ?? 'Nevera',
    descripcion: parcial.descripcion ?? null,
    montoTotal: minor(parcial.montoTotal),
    modalidad,
    estado: parcial.estado ?? 'ACTIVO',
    periodicidad: parcial.periodicidad ?? (modalidad === 'CUOTAS_PERIODICAS' ? 'MENSUAL' : null),
    fechaInicio: parcial.fechaInicio ?? null,
    fechaLimite: parcial.fechaLimite ?? null,
    involucrados: parcial.involucrados.map((miembroId, orden) => ({
      miembroId,
      tipoParte: 'IGUAL' as const,
      valorParte: 0,
      orden,
    })),
    version: 1,
    creadoEn: '2026-08-01T00:00:00.000Z',
  };
}

let contador = 0;

export function aporte(parcial: {
  id?: string;
  objetivoId?: string;
  acreditadoA: string;
  pagadoPor?: string;
  monto: number;
  fechaValor?: string;
  periodoIndice?: number | null;
  anulacion?: Anulacion | null;
  registradoEn?: string;
}): Aporte {
  contador += 1;
  return {
    id: parcial.id ?? `ap${String(contador)}`,
    grupoId: 'g1',
    objetivoId: parcial.objetivoId ?? 'o1',
    acreditadoA: parcial.acreditadoA,
    pagadoPor: parcial.pagadoPor ?? parcial.acreditadoA,
    monto: minor(parcial.monto),
    fechaValor: fechaCivil(parcial.fechaValor ?? '2026-09-10'),
    periodoIndice: parcial.periodoIndice ?? null,
    metodo: null,
    nota: null,
    registradoPor: 'Ana',
    registradoEn: parcial.registradoEn ?? '2026-09-10T12:00:00.000Z',
    anulacion: parcial.anulacion ?? null,
  };
}

export const ANULADO: Anulacion = {
  motivo: 'Monto equivocado',
  anuladoPor: 'Ana',
  anuladoEn: '2026-09-12T10:00:00.000Z',
};

export const HOY = fechaCivil('2026-09-15');
