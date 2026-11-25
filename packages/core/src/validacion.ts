import { esMonto } from './dinero.js';
import { esFechaCivil } from './fecha.js';
import type { FechaCivil, Id, Involucrado, Modalidad, Periodicidad } from './tipos.js';

/**
 * Validación previa a guardar — RF-07 y casos borde CB-01 a CB-04, CB-09.
 *
 * Devuelve **todos** los problemas, no el primero: quien está creando un objetivo desde el
 * teléfono merece ver de una vez todo lo que falta. Cuando el reparto no cuadra se informa
 * la diferencia exacta y no se ajusta en silencio (RN-03): repartir la diferencia por su
 * cuenta sería inventar un acuerdo que la familia no tomó.
 */

export interface Problema {
  codigo: string;
  campo: string;
  mensaje: string;
  /** Cuánto falta (positivo) o sobra (negativo), cuando el problema es de cuadre. */
  diferencia?: number;
}

export interface BorradorObjetivo {
  nombre: string;
  montoTotal: number;
  modalidad: Modalidad;
  periodicidad: Periodicidad | null;
  fechaInicio: string | null;
  fechaLimite: string | null;
  involucrados: Involucrado[];
}

export function validarObjetivo(borrador: BorradorObjetivo): Problema[] {
  const problemas: Problema[] = [];

  if (borrador.nombre.trim() === '') {
    problemas.push({
      codigo: 'NOMBRE_VACIO',
      campo: 'nombre',
      mensaje: 'El objetivo necesita un nombre para que la familia sepa de qué se trata.',
    });
  }

  // CB-03 — un objetivo de monto 0 o negativo no reparte nada.
  if (!esMonto(borrador.montoTotal) || borrador.montoTotal <= 0) {
    problemas.push({
      codigo: 'MONTO_INVALIDO',
      campo: 'montoTotal',
      mensaje: 'El monto total debe ser un número entero mayor que cero (CB-03).',
    });
  }

  // CB-02 — sin involucrados no hay a quién repartir. CB-01 confirma que uno solo es válido.
  if (borrador.involucrados.length === 0) {
    problemas.push({
      codigo: 'SIN_INVOLUCRADOS',
      campo: 'involucrados',
      mensaje: 'Hay que elegir al menos a una persona que aporte a este objetivo (CB-02).',
    });
  }

  const vistos = new Set<Id>();
  for (const involucrado of borrador.involucrados) {
    if (vistos.has(involucrado.miembroId)) {
      problemas.push({
        codigo: 'INVOLUCRADO_REPETIDO',
        campo: 'involucrados',
        mensaje: 'Una misma persona aparece dos veces entre los involucrados.',
      });
    }
    vistos.add(involucrado.miembroId);

    if (involucrado.tipoParte !== 'IGUAL') {
      problemas.push({
        codigo: 'TIPO_DE_REPARTO_NO_DISPONIBLE',
        campo: 'involucrados',
        mensaje:
          'Por ahora el reparto es en partes iguales. Los porcentajes (RN-02) y los montos ' +
          'fijos (RN-03) llegan en el siguiente incremento.',
      });
    }
  }

  if (borrador.modalidad === 'CUOTAS_PERIODICAS') {
    problemas.push(...validarCalendario(borrador));
  } else {
    if (borrador.fechaInicio !== null) {
      problemas.push({
        codigo: 'INICIO_SIN_CUOTAS',
        campo: 'fechaInicio',
        mensaje: 'Un objetivo de monto repartido no lleva fecha de inicio; solo fecha límite opcional.',
      });
    }
    if (borrador.periodicidad !== null) {
      problemas.push({
        codigo: 'PERIODICIDAD_SIN_CUOTAS',
        campo: 'periodicidad',
        mensaje: 'Un objetivo de monto repartido no tiene periodicidad.',
      });
    }
    if (borrador.fechaLimite !== null && !esFechaCivil(borrador.fechaLimite)) {
      problemas.push({
        codigo: 'FECHA_INVALIDA',
        campo: 'fechaLimite',
        mensaje: 'La fecha límite no es una fecha válida.',
      });
    }
  }

  return problemas;
}

function validarCalendario(borrador: BorradorObjetivo): Problema[] {
  const problemas: Problema[] = [];

  if (borrador.periodicidad !== 'MENSUAL') {
    problemas.push({
      codigo: 'PERIODICIDAD_NO_SOPORTADA',
      campo: 'periodicidad',
      mensaje: 'La única periodicidad disponible es la mensual (PA-01).',
    });
  }

  const inicioValido = borrador.fechaInicio !== null && esFechaCivil(borrador.fechaInicio);
  const limiteValido = borrador.fechaLimite !== null && esFechaCivil(borrador.fechaLimite);

  if (!inicioValido) {
    problemas.push({
      codigo: 'FECHA_INVALIDA',
      campo: 'fechaInicio',
      mensaje: 'Un objetivo por cuotas necesita una fecha de inicio válida.',
    });
  }
  if (!limiteValido) {
    problemas.push({
      codigo: 'FECHA_INVALIDA',
      campo: 'fechaLimite',
      mensaje: 'Un objetivo por cuotas necesita una fecha límite válida.',
    });
  }

  // RN-05 — límite anterior al inicio: no hay periodos que generar.
  if (inicioValido && limiteValido) {
    const inicio = borrador.fechaInicio as FechaCivil;
    const limite = borrador.fechaLimite as FechaCivil;
    if (limite < inicio) {
      problemas.push({
        codigo: 'LIMITE_ANTERIOR_A_INICIO',
        campo: 'fechaLimite',
        mensaje: 'La fecha límite es anterior a la de inicio: no habría ninguna cuota (RN-05).',
      });
    }
  }

  return problemas;
}

export interface BorradorAporte {
  monto: number;
  fechaValor: string;
  acreditadoA: Id;
  pagadoPor: Id;
  periodoIndice: number | null;
  registradoPor: string;
}

export interface ContextoAporte {
  /** Involucrados del objetivo: `acreditadoA` tiene que ser uno de ellos (INV-06). */
  involucrados: Id[];
  /** Miembros del grupo: `pagadoPor` puede ser cualquiera, aunque no esté involucrado. */
  miembrosDelGrupo: Id[];
  /** Número de periodos del objetivo; 0 si es de reparto único. */
  nPeriodos: number;
}

export function validarAporte(borrador: BorradorAporte, contexto: ContextoAporte): Problema[] {
  const problemas: Problema[] = [];

  // CB-04 — para revertir se anula (RN-13), no se registra un aporte negativo.
  if (!esMonto(borrador.monto) || borrador.monto <= 0) {
    problemas.push({
      codigo: 'MONTO_INVALIDO',
      campo: 'monto',
      mensaje: 'El aporte debe ser mayor que cero. Para revertir uno errado se anula (CB-04, RN-13).',
    });
  }

  // CB-05 — una fecha anterior a la creación del objetivo es válida: registrar es retroactivo.
  if (!esFechaCivil(borrador.fechaValor)) {
    problemas.push({
      codigo: 'FECHA_INVALIDA',
      campo: 'fechaValor',
      mensaje: 'La fecha del aporte no es una fecha válida.',
    });
  }

  if (!contexto.involucrados.includes(borrador.acreditadoA)) {
    problemas.push({
      codigo: 'ACREDITADO_NO_INVOLUCRADO',
      campo: 'acreditadoA',
      mensaje: 'Solo se puede acreditar el aporte a alguien involucrado en el objetivo (INV-06).',
    });
  }

  if (!contexto.miembrosDelGrupo.includes(borrador.pagadoPor)) {
    problemas.push({
      codigo: 'PAGADOR_NO_ES_MIEMBRO',
      campo: 'pagadoPor',
      mensaje: 'Quien paga tiene que ser un miembro del grupo (INV-06).',
    });
  }

  if (borrador.registradoPor.trim() === '') {
    problemas.push({
      codigo: 'REGISTRADO_POR_VACIO',
      campo: 'registradoPor',
      mensaje: 'Falta decir quién registra el aporte. Sirve para recordar, no para probar (RN-17).',
    });
  }

  if (borrador.periodoIndice !== null) {
    if (contexto.nPeriodos === 0) {
      problemas.push({
        codigo: 'PERIODO_EN_OBJETIVO_SIN_CUOTAS',
        campo: 'periodoIndice',
        mensaje: 'Este objetivo no tiene cuotas mensuales, así que no hay periodo al que imputar.',
      });
    } else if (
      !Number.isInteger(borrador.periodoIndice) ||
      borrador.periodoIndice < 0 ||
      borrador.periodoIndice >= contexto.nPeriodos
    ) {
      problemas.push({
        codigo: 'PERIODO_FUERA_DE_RANGO',
        campo: 'periodoIndice',
        mensaje: `El periodo indicado no existe: este objetivo tiene ${String(contexto.nPeriodos)} cuotas.`,
      });
    }
  }

  return problemas;
}
