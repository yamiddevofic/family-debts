import type { FechaCivil } from './tipos.js';

/**
 * Fechas civiles — DT-11.
 *
 * Un vencimiento es "el 5 de diciembre": no tiene hora ni zona horaria. Representarlo con
 * `Date` invita a que se corra un día según el huso del teléfono, y eso convierte en moroso
 * a quien no lo es. Aquí una fecha es la cadena `AAAA-MM-DD` y nada más.
 *
 * El formato ISO no es estético: su orden lexicográfico coincide con el cronológico, así que
 * comparar fechas es comparar cadenas, tanto aquí como en SQL. La interfaz las muestra en
 * `DD-MM-AAAA`, y esa conversión vive solo en `apps/web` (DT-11).
 *
 * La aritmética de calendario está escrita a mano a propósito: el núcleo no tiene
 * dependencias (Artículo II, DT-03).
 */

export class ErrorDeFecha extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeFecha';
  }
}

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

/** Último día del mes `mes` (1-12) del año `anio`. Resuelve el desbordamiento de RN-05. */
export function ultimoDiaDelMes(anio: number, mes: number): number {
  if (mes === 2 && esBisiesto(anio)) return 29;
  const dias = DIAS_POR_MES[mes - 1];
  if (dias === undefined) throw new ErrorDeFecha(`Mes fuera de rango: ${String(mes)}.`);
  return dias;
}

export interface PartesDeFecha {
  anio: number;
  mes: number;
  dia: number;
}

/** Constructor validado. Rechaza formatos raros y fechas que no existen (30 de febrero). */
export function fechaCivil(texto: string): FechaCivil {
  const coincidencia = FORMATO.exec(texto);
  if (!coincidencia) {
    throw new ErrorDeFecha(`Una fecha civil se escribe AAAA-MM-DD; se recibió "${texto}".`);
  }
  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  if (mes < 1 || mes > 12) throw new ErrorDeFecha(`El mes ${String(mes)} no existe en "${texto}".`);
  if (dia < 1 || dia > ultimoDiaDelMes(anio, mes)) {
    throw new ErrorDeFecha(`El día ${String(dia)} no existe en ese mes: "${texto}".`);
  }
  return texto as FechaCivil;
}

export function esFechaCivil(texto: unknown): texto is string {
  if (typeof texto !== 'string') return false;
  try {
    fechaCivil(texto);
    return true;
  } catch {
    return false;
  }
}

export function partes(fecha: FechaCivil): PartesDeFecha {
  return {
    anio: Number(fecha.slice(0, 4)),
    mes: Number(fecha.slice(5, 7)),
    dia: Number(fecha.slice(8, 10)),
  };
}

function conCeros(n: number, ancho: number): string {
  return String(n).padStart(ancho, '0');
}

export function componer(anio: number, mes: number, dia: number): FechaCivil {
  return `${conCeros(anio, 4)}-${conCeros(mes, 2)}-${conCeros(dia, 2)}` as FechaCivil;
}

/** Negativo si `a` es anterior, 0 si son la misma, positivo si `a` es posterior. */
export function comparar(a: FechaCivil, b: FechaCivil): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function esAnterior(a: FechaCivil, b: FechaCivil): boolean {
  return a < b;
}

export function esPosterior(a: FechaCivil, b: FechaCivil): boolean {
  return a > b;
}

/**
 * Avanza `meses` meses conservando el día de origen, y lo recorta al último día del mes
 * cuando ese día no existe (RN-05): del 31 de enero se pasa al 28 o 29 de febrero.
 *
 * El día que se conserva es el de la fecha original, no el ya recortado: por eso 31-ene
 * avanza a 28-feb y luego a 31-mar, en vez de quedarse clavado en el 28.
 */
export function sumarMeses(fecha: FechaCivil, meses: number): FechaCivil {
  const { anio, mes, dia } = partes(fecha);
  const total = (anio * 12 + (mes - 1)) + meses;
  const anioDestino = Math.floor(total / 12);
  const mesDestino = (total % 12) + 1;
  const diaDestino = Math.min(dia, ultimoDiaDelMes(anioDestino, mesDestino));
  return componer(anioDestino, mesDestino, diaDestino);
}
