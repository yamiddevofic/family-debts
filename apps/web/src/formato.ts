import type { FechaCivil, Moneda } from '@deudas/core';

/**
 * Formato de presentación — RNF-07, DT-11 y T-035/T-036.
 *
 * **Aquí, y solo aquí, existe el formato `DD-MM-AAAA`.** El núcleo y la API hablan siempre
 * `AAAA-MM-DD`, porque ese orden lexicográfico es el que hace que comparar y ordenar fechas
 * funcione en SQL y en el dominio. Pero un vencimiento en formato ISO se lee mal de un
 * vistazo en el teléfono, y RNF-03 pide justamente que se entienda de un vistazo.
 */

const FORMATO_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORMATO_VISTA = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;

/** `2026-12-05` → `05-12-2026`. */
export function aVista(fecha: FechaCivil | string): string {
  const partes = FORMATO_ISO.exec(fecha);
  if (!partes) return String(fecha);
  return `${partes[3] ?? ''}-${partes[2] ?? ''}-${partes[1] ?? ''}`;
}

/**
 * `05-12-2026` → `2026-12-05`. Devuelve `null` cuando la fecha no es válida, en vez de
 * adivinar: `05-06-2026` escrito a mano es ambiguo para una persona pero no para esta
 * función, que siempre lee día-mes-año. Si el texto no cumple, la interfaz pide corregir.
 */
export function deVista(texto: string): FechaCivil | null {
  const partes = FORMATO_VISTA.exec(texto.trim());
  if (!partes) return null;
  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  const anio = Number(partes[3]);
  if (mes < 1 || mes > 12) return null;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  if (dia < 1 || dia > ultimo) return null;
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}` as FechaCivil;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** `2026-12-05` → `5 de diciembre de 2026`, para cuando hay espacio para leerlo entero. */
export function aTextoLargo(fecha: FechaCivil | string): string {
  const partes = FORMATO_ISO.exec(fecha);
  if (!partes) return String(fecha);
  const mes = MESES[Number(partes[2]) - 1] ?? '';
  return `${String(Number(partes[3]))} de ${mes} de ${partes[1] ?? ''}`;
}

/** `2026-12-05` → `dic 2026`, para encabezados de cuota. */
export function aMesCorto(fecha: FechaCivil | string): string {
  const partes = FORMATO_ISO.exec(fecha);
  if (!partes) return String(fecha);
  const mes = MESES[Number(partes[2]) - 1] ?? '';
  return `${mes.slice(0, 3)} ${partes[1] ?? ''}`;
}

/**
 * Montos con separadores locales y **sin decimales cuando el exponente es 0** (RNF-07).
 * El monto llega en la unidad mínima: 1200000 en COP es $1.200.000; en USD, $12.000,00.
 */
export function aMoneda(monto: number, moneda: Moneda): string {
  const valor = moneda.exponente === 0 ? monto : monto / 10 ** moneda.exponente;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: moneda.codigo,
    minimumFractionDigits: moneda.exponente,
    maximumFractionDigits: moneda.exponente,
  }).format(valor);
}

/** Igual que `aMoneda` pero sin el símbolo, para celdas donde el símbolo ya se entiende. */
export function aNumero(monto: number, moneda: Moneda): string {
  const valor = moneda.exponente === 0 ? monto : monto / 10 ** moneda.exponente;
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: moneda.exponente,
    maximumFractionDigits: moneda.exponente,
  }).format(valor);
}

/** Convierte lo que la persona escribió en un campo de monto a la unidad mínima. */
export function deTextoAMonto(texto: string, moneda: Moneda): number | null {
  const limpio = texto.replace(/[^\d,.-]/g, '').replaceAll('.', '').replace(',', '.');
  if (limpio === '') return null;
  const valor = Number(limpio);
  if (!Number.isFinite(valor)) return null;
  const enMinima = Math.round(valor * 10 ** moneda.exponente);
  return Number.isSafeInteger(enMinima) ? enMinima : null;
}

export function porcentaje(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((parte / total) * 100));
}
