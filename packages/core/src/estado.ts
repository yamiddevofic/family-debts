import { generarPeriodos } from './calendario.js';
import { CERO, diferencia, minor, negativo, positivo, sumar } from './dinero.js';
import { esAnterior, esPosterior } from './fecha.js';
import { imputar, type AplicacionDeAporte, type AporteImputable } from './imputacion.js';
import { repartir, repartirEnPeriodos } from './reparto.js';
import type {
  Aporte,
  EstadoAlmacenado,
  FechaCivil,
  Grupo,
  Id,
  Miembro,
  Minor,
  Modalidad,
  Objetivo,
  Periodo,
} from './tipos.js';

/**
 * Estado derivado — RN-07, RN-09, RN-10, RN-12 y RF-15.
 *
 * Nada de lo que se calcula aquí se guarda jamás (Artículo IV). "Cuánto debe Ana" y "quién
 * está en mora" son funciones puras sobre los hechos: miembros, objetivos y aportes. Un
 * saldo derivado no puede desincronizarse, y anular un aporte de hace tres meses recalcula
 * todo lo que dependía de él sin migrar un solo registro.
 *
 * La `fechaReferencia` entra como parámetro (Artículo II): el núcleo no lee el reloj, y por
 * eso se puede preguntar "¿quién estaba en mora el 30 de junio?".
 */

/** Un aporte tal como se muestra al desglosar una cifra (RF-15, Artículo V). */
export interface DesgloseAporte {
  aporteId: Id;
  monto: Minor;
  fechaValor: FechaCivil;
  acreditadoA: Id;
  pagadoPor: Id;
  /** Verdadero cuando `pagadoPor` no es `acreditadoA`: alguien pagó por otro (RN-15). */
  porCuentaDeOtro: boolean;
  periodoIndice: number | null;
  metodo: string | null;
  nota: string | null;
  registradoPor: string;
  registradoEn: string;
  /** Fecha de valor posterior a la de referencia (CB-06). No cuenta para la mora. */
  futuro: boolean;
  anulado: boolean;
  motivoAnulacion: string | null;
}

export interface EstadoPeriodoMiembro {
  indice: number;
  fechaVencimiento: FechaCivil;
  cuota: Minor;
  aplicado: Minor;
  pendiente: Minor;
  aFavor: Minor;
  enMora: boolean;
  aportes: AplicacionDeAporte[];
}

export interface EstadoInvolucrado {
  miembroId: Id;
  orden: number;
  obligacion: Minor;
  aportado: Minor;
  /** Entero con signo: positivo es deuda, negativo es saldo a favor. */
  saldo: number;
  debe: Minor;
  aFavor: Minor;
  enMora: boolean;
  periodos: EstadoPeriodoMiembro[];
  /**
   * Identificadores de los aportes que componen `aportado`, para desglosar la cifra
   * (RF-15). Son referencias a `EstadoObjetivo.aportes` y no copias: repetir aquí los doce
   * campos de cada aporte duplicaba el tamaño de la respuesta, y con 2.000 aportes eso son
   * megabytes de más viajando a un teléfono con mala señal (RNF-04, RNF-05).
   */
  desglose: Id[];
}

export interface EstadoObjetivo {
  objetivoId: Id;
  nombre: string;
  descripcion: string | null;
  modalidad: Modalidad;
  estado: EstadoAlmacenado;
  montoTotal: Minor;
  fechaInicio: FechaCivil | null;
  fechaLimite: FechaCivil | null;
  version: number;
  periodos: Periodo[];
  involucrados: EstadoInvolucrado[];
  /** Suma de todos los aportes no anulados del objetivo (RN-07). */
  recaudado: Minor;
  /** Suma de los saldos positivos. Puede diferir de `montoTotal − recaudado` (RN-07). */
  faltante: Minor;
  aFavorTotal: Minor;
  saldado: boolean;
  enMora: boolean;
  /** Todos los aportes del objetivo, anulados incluidos, para el historial (Artículo V). */
  aportes: DesgloseAporte[];
}

export interface ResumenMiembro {
  miembroId: Id;
  debeTotal: Minor;
  aFavorTotal: Minor;
  aportadoTotal: Minor;
  enMora: boolean;
  objetivos: { objetivoId: Id; nombre: string; debe: Minor; aFavor: Minor; enMora: boolean }[];
}

export interface EstadoGrupo {
  grupoId: Id;
  nombre: string;
  moneda: Grupo['moneda'];
  fechaReferencia: FechaCivil;
  miembros: Miembro[];
  objetivos: EstadoObjetivo[];
  porMiembro: ResumenMiembro[];
  /** Totales sobre objetivos `ACTIVO`: los cancelados dejan de exigirse (RN-16). */
  totalNecesario: Minor;
  totalRecaudado: Minor;
  totalFaltante: Minor;
}

function aDesglose(aporte: Aporte, hoy: FechaCivil): DesgloseAporte {
  return {
    aporteId: aporte.id,
    monto: aporte.monto,
    fechaValor: aporte.fechaValor,
    acreditadoA: aporte.acreditadoA,
    pagadoPor: aporte.pagadoPor,
    porCuentaDeOtro: aporte.pagadoPor !== aporte.acreditadoA,
    periodoIndice: aporte.periodoIndice,
    metodo: aporte.metodo,
    nota: aporte.nota,
    registradoPor: aporte.registradoPor,
    registradoEn: aporte.registradoEn,
    futuro: esPosterior(aporte.fechaValor, hoy),
    anulado: aporte.anulacion !== null,
    motivoAnulacion: aporte.anulacion?.motivo ?? null,
  };
}

function aImputable(aporte: Aporte): AporteImputable {
  return {
    id: aporte.id,
    monto: aporte.monto,
    periodoIndice: aporte.periodoIndice,
    fechaValor: aporte.fechaValor,
    registradoEn: aporte.registradoEn,
  };
}

/**
 * Estado completo de un objetivo a una fecha de referencia dada.
 *
 * `aportes` debe traer **todos** los del objetivo, anulados incluidos: los anulados no
 * mueven ningún saldo (INV-05) pero siguen visibles en el historial (Artículo V).
 */
export function estadoObjetivo(
  objetivo: Objetivo,
  aportes: Aporte[],
  fechaReferencia: FechaCivil,
): EstadoObjetivo {
  const delObjetivo = aportes.filter((a) => a.objetivoId === objetivo.id);
  const vigentes = delObjetivo.filter((a) => a.anulacion === null);

  // RN-16: en un objetivo CANCELADO las obligaciones dejan de exigirse, así que todo lo que
  // ya se aportó queda como saldo a favor visible. No se borra nada ni se devuelve nada: el
  // sistema señala la plata que quedó suelta y la familia decide qué hacer con ella.
  const cancelado = objetivo.estado === 'CANCELADO';
  const obligaciones = new Map(
    cancelado
      ? objetivo.involucrados.map((i) => [i.miembroId, CERO] as const)
      : repartir(objetivo.montoTotal, objetivo.involucrados).map((p) => [p.miembroId, p.montoDebido]),
  );

  const periodos =
    !cancelado && objetivo.modalidad === 'CUOTAS_PERIODICAS' && objetivo.fechaInicio && objetivo.fechaLimite
      ? generarPeriodos(objetivo.fechaInicio, objetivo.fechaLimite)
      : [];

  // Un vencimiento pasado solo genera mora si sigue pendiente a la fecha de referencia
  // contando únicamente el dinero que ya existía entonces (CB-06).
  const vencido = (fecha: FechaCivil): boolean => esAnterior(fecha, fechaReferencia);

  const involucrados: EstadoInvolucrado[] = objetivo.involucrados
    .map((involucrado) => {
      const obligacion = obligaciones.get(involucrado.miembroId) ?? CERO;
      const suyos = vigentes.filter((a) => a.acreditadoA === involucrado.miembroId);
      const aportado = sumar(...suyos.map((a) => a.monto));
      const saldo = diferencia(obligacion, aportado);

      let periodosMiembro: EstadoPeriodoMiembro[] = [];
      let enMora = false;

      if (periodos.length > 0) {
        const cuotas = repartirEnPeriodos(obligacion, periodos.length);
        const imputacion = imputar(cuotas, suyos.map(aImputable));
        // Segunda imputación, solo con lo que ya estaba puesto a la fecha de referencia:
        // un aporte con fecha futura no rescata un periodo vencido (CB-06).
        const aLaFecha = imputar(
          cuotas,
          suyos.filter((a) => !esPosterior(a.fechaValor, fechaReferencia)).map(aImputable),
        );

        periodosMiembro = imputacion.periodos.map((p, i) => {
          const periodo = periodos[i];
          const pendienteALaFecha = aLaFecha.periodos[i]?.pendiente ?? CERO;
          const moroso = periodo !== undefined && vencido(periodo.fechaVencimiento) && pendienteALaFecha > 0;
          if (moroso) enMora = true;
          return {
            indice: p.periodoIndice,
            fechaVencimiento: periodo?.fechaVencimiento ?? ('' as FechaCivil),
            cuota: p.cuota,
            aplicado: p.aplicado,
            pendiente: p.pendiente,
            aFavor: p.aFavor,
            enMora: moroso,
            aportes: p.aportes,
          };
        });
      } else if (!cancelado && objetivo.fechaLimite !== null && vencido(objetivo.fechaLimite)) {
        // RN-12: un reparto único sin fecha límite nunca genera mora; con ella, sí.
        const aportadoALaFecha = sumar(
          ...suyos.filter((a) => !esPosterior(a.fechaValor, fechaReferencia)).map((a) => a.monto),
        );
        enMora = diferencia(obligacion, aportadoALaFecha) > 0;
      }

      return {
        miembroId: involucrado.miembroId,
        orden: involucrado.orden,
        obligacion,
        aportado,
        saldo,
        debe: positivo(saldo),
        aFavor: negativo(saldo),
        enMora,
        periodos: periodosMiembro,
        desglose: suyos.map((a) => a.id),
      };
    })
    .sort((a, b) => a.orden - b.orden);

  const recaudado = sumar(...vigentes.map((a) => a.monto));
  const faltante = sumar(...involucrados.map((i) => i.debe));
  const aFavorTotal = sumar(...involucrados.map((i) => i.aFavor));

  return {
    objetivoId: objetivo.id,
    nombre: objetivo.nombre,
    descripcion: objetivo.descripcion,
    modalidad: objetivo.modalidad,
    estado: objetivo.estado,
    montoTotal: objetivo.montoTotal,
    fechaInicio: objetivo.fechaInicio,
    fechaLimite: objetivo.fechaLimite,
    version: objetivo.version,
    periodos,
    involucrados,
    recaudado,
    faltante,
    aFavorTotal,
    // RN-10: saldado es derivado. Nunca se escribe, y puede dejar de serlo si se anula un
    // aporte o si sube el monto total, que es exactamente lo correcto. Un objetivo CANCELADO
    // no está saldado: dejó de exigir, que no es lo mismo que haberse cumplido.
    saldado: !cancelado && faltante === 0,
    enMora: involucrados.some((i) => i.enMora),
    aportes: delObjetivo.map((a) => aDesglose(a, fechaReferencia)),
  };
}

/** Estado completo de un grupo: lo que necesita el tablero de HU-06 en una sola pasada. */
export function estadoGrupo(
  grupo: Grupo,
  miembros: Miembro[],
  objetivos: Objetivo[],
  aportes: Aporte[],
  fechaReferencia: FechaCivil,
): EstadoGrupo {
  const porObjetivo = new Map<Id, Aporte[]>();
  for (const aporte of aportes) {
    const lista = porObjetivo.get(aporte.objetivoId);
    if (lista) lista.push(aporte);
    else porObjetivo.set(aporte.objetivoId, [aporte]);
  }

  const estados = objetivos.map((objetivo) =>
    estadoObjetivo(objetivo, porObjetivo.get(objetivo.id) ?? [], fechaReferencia),
  );

  const activos = estados.filter((e) => e.estado === 'ACTIVO');

  const porMiembro: ResumenMiembro[] = miembros.map((miembro) => {
    const lineas = activos
      .map((estado) => {
        const suyo = estado.involucrados.find((i) => i.miembroId === miembro.id);
        if (!suyo) return null;
        return {
          objetivoId: estado.objetivoId,
          nombre: estado.nombre,
          debe: suyo.debe,
          aFavor: suyo.aFavor,
          enMora: suyo.enMora,
        };
      })
      .filter((linea): linea is NonNullable<typeof linea> => linea !== null);

    const aportadoTotal = sumar(
      ...estados.flatMap((estado) =>
        estado.involucrados.filter((i) => i.miembroId === miembro.id).map((i) => i.aportado),
      ),
    );

    return {
      miembroId: miembro.id,
      debeTotal: sumar(...lineas.map((l) => l.debe)),
      aFavorTotal: sumar(...lineas.map((l) => l.aFavor)),
      aportadoTotal,
      enMora: lineas.some((l) => l.enMora),
      objetivos: lineas,
    };
  });

  return {
    grupoId: grupo.id,
    nombre: grupo.nombre,
    moneda: grupo.moneda,
    fechaReferencia,
    miembros,
    objetivos: estados,
    porMiembro,
    totalNecesario: sumar(...activos.map((e) => e.montoTotal)),
    totalRecaudado: sumar(...activos.map((e) => e.recaudado)),
    totalFaltante: sumar(...activos.map((e) => e.faltante)),
  };
}

/** Cuota que le toca a cada involucrado en un periodo, sin recalcular todo el estado. */
export function cuotasDelPeriodo(objetivo: Objetivo, indice: number): Map<Id, Minor> {
  const cuotas = new Map<Id, Minor>();
  if (objetivo.modalidad !== 'CUOTAS_PERIODICAS' || !objetivo.fechaInicio || !objetivo.fechaLimite) {
    return cuotas;
  }
  const periodos = generarPeriodos(objetivo.fechaInicio, objetivo.fechaLimite);
  for (const parte of repartir(objetivo.montoTotal, objetivo.involucrados)) {
    const reparto = repartirEnPeriodos(parte.montoDebido, periodos.length);
    cuotas.set(parte.miembroId, reparto[indice] ?? minor(0));
  }
  return cuotas;
}
