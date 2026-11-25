import { CERO, minimo, minor, restarSinBajarDeCero, sumar } from './dinero.js';
import type { FechaCivil, Id, MarcaDeTiempo, Minor } from './tipos.js';

/**
 * Imputación — RN-08.
 *
 * Repartir un aporte entre los periodos de un objetivo de cuotas es un cálculo, no un dato:
 * anular un aporte de marzo recalcula abril y mayo sin tocar nada guardado (Artículo IV).
 *
 * Dos comportamientos distintos, ambos de RN-08:
 * - Un aporte **con** periodo indicado se imputa allí y se queda allí, aunque sobre. La
 *   persona dijo para qué mes era; el sistema no la corrige.
 * - Un aporte **sin** periodo va al periodo pendiente más antiguo y el excedente cae en
 *   cascada al siguiente pendiente.
 */

export interface AporteImputable {
  id: Id;
  monto: Minor;
  /** `null` = imputar al pendiente más antiguo. */
  periodoIndice: number | null;
  fechaValor: FechaCivil;
  registradoEn: MarcaDeTiempo;
}

export interface AplicacionDeAporte {
  aporteId: Id;
  monto: Minor;
}

export interface ImputacionPorPeriodo {
  periodoIndice: number;
  cuota: Minor;
  aplicado: Minor;
  pendiente: Minor;
  /** Lo que sobró en este periodo por un aporte dirigido explícitamente a él. */
  aFavor: Minor;
  aportes: AplicacionDeAporte[];
}

export interface ResultadoImputacion {
  periodos: ImputacionPorPeriodo[];
  /** Excedente que no cupo en ningún periodo: saldo a favor del miembro (RN-09). */
  aFavor: Minor;
}

/** Orden estable y reproducible: por fecha de valor, luego por registro, luego por id. */
function porAntiguedad(a: AporteImputable, b: AporteImputable): number {
  if (a.fechaValor !== b.fechaValor) return a.fechaValor < b.fechaValor ? -1 : 1;
  if (a.registradoEn !== b.registradoEn) return a.registradoEn < b.registradoEn ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function imputar(cuotas: Minor[], aportes: AporteImputable[]): ResultadoImputacion {
  const periodos: ImputacionPorPeriodo[] = cuotas.map((cuota, indice) => ({
    periodoIndice: indice,
    cuota,
    aplicado: CERO,
    pendiente: cuota,
    aFavor: CERO,
    aportes: [],
  }));

  const dirigidos = aportes.filter((a) => a.periodoIndice !== null).sort(porAntiguedad);
  const libres = aportes.filter((a) => a.periodoIndice === null).sort(porAntiguedad);

  let aFavor = CERO;

  // Primero los dirigidos: así la cascada de los libres ve el estado real de cada periodo.
  for (const aporte of dirigidos) {
    const destino = periodos[aporte.periodoIndice as number];
    if (!destino) {
      // Un periodo que ya no existe (la fecha límite se acortó): el aporte no se pierde,
      // queda como saldo a favor del miembro en el objetivo.
      aFavor = sumar(aFavor, aporte.monto);
      continue;
    }
    const cubre = minimo(aporte.monto, destino.pendiente);
    destino.aplicado = sumar(destino.aplicado, aporte.monto);
    destino.pendiente = restarSinBajarDeCero(destino.pendiente, cubre);
    destino.aFavor = restarSinBajarDeCero(destino.aplicado, destino.cuota);
    destino.aportes.push({ aporteId: aporte.id, monto: aporte.monto });
  }

  for (const aporte of libres) {
    let restante: Minor = aporte.monto;
    for (const periodo of periodos) {
      if (restante === 0) break;
      if (periodo.pendiente === 0) continue;
      const cubre = minimo(restante, periodo.pendiente);
      periodo.aplicado = sumar(periodo.aplicado, cubre);
      periodo.pendiente = restarSinBajarDeCero(periodo.pendiente, cubre);
      periodo.aportes.push({ aporteId: aporte.id, monto: cubre });
      restante = minor(restante - cubre);
    }
    // Lo que no cupo en ningún periodo pendiente es saldo a favor (RN-09).
    if (restante > 0) aFavor = sumar(aFavor, restante);
  }

  return { periodos, aFavor };
}
