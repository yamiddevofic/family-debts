/**
 * Tipos del dominio. Estructuras planas y serializables: el núcleo no tiene clases,
 * no guarda estado y no conoce red, base de datos ni reloj (Artículo II).
 */

/** Monto entero en la unidad mínima de la moneda del grupo (Artículo III, DT-04). */
export type Minor = number & { readonly __brand: 'Minor' };

/** Fecha civil `AAAA-MM-DD`: sin hora y sin zona horaria (DT-11). */
export type FechaCivil = string & { readonly __brand: 'FechaCivil' };

/** Marca de tiempo real, en UTC ISO-8601. Solo `registradoEn` y `anuladoEn` la usan. */
export type MarcaDeTiempo = string;

export type Id = string;

export type TipoParte = 'IGUAL' | 'PORCENTAJE' | 'MONTO_FIJO';
export type Modalidad = 'REPARTO_UNICO' | 'CUOTAS_PERIODICAS';
export type EstadoAlmacenado = 'ACTIVO' | 'CANCELADO' | 'ARCHIVADO';
export type Periodicidad = 'MENSUAL';

export interface Moneda {
  /** Código ISO-4217, p. ej. `COP`. */
  codigo: string;
  /** Exponente decimal: 0 para COP, 2 para USD (CB-14). */
  exponente: number;
}

export interface Grupo {
  id: Id;
  nombre: string;
  moneda: Moneda;
  creadoEn: MarcaDeTiempo;
}

export interface Miembro {
  id: Id;
  grupoId: Id;
  nombre: string;
  activo: boolean;
  creadoEn: MarcaDeTiempo;
}

/** Vínculo entre un objetivo y un miembro, con su regla de reparto. */
export interface Involucrado {
  miembroId: Id;
  tipoParte: TipoParte;
  /** Puntos básicos si `PORCENTAJE`, monto si `MONTO_FIJO`, ignorado si `IGUAL`. */
  valorParte: number;
  /** Orden de incorporación. Desempata el residuo (RN-04). */
  orden: number;
}

export interface Objetivo {
  id: Id;
  grupoId: Id;
  nombre: string;
  descripcion: string | null;
  montoTotal: Minor;
  modalidad: Modalidad;
  estado: EstadoAlmacenado;
  periodicidad: Periodicidad | null;
  fechaInicio: FechaCivil | null;
  fechaLimite: FechaCivil | null;
  involucrados: Involucrado[];
  version: number;
  creadoEn: MarcaDeTiempo;
}

/** Marca inmutable sobre un aporte (RN-13, Artículo V). */
export interface Anulacion {
  motivo: string;
  anuladoPor: string;
  anuladoEn: MarcaDeTiempo;
}

/** Hecho registrado de que alguien puso dinero. Solo se añade (Artículo V). */
export interface Aporte {
  id: Id;
  grupoId: Id;
  objetivoId: Id;
  /** A quién se le reduce la deuda (RN-15). */
  acreditadoA: Id;
  /** Quién puso el dinero materialmente (RN-15). */
  pagadoPor: Id;
  monto: Minor;
  fechaValor: FechaCivil;
  /** `null` = imputar al periodo pendiente más antiguo (RN-08). */
  periodoIndice: number | null;
  metodo: string | null;
  nota: string | null;
  /** Nombre auto-declarado. No es autenticación (RN-17). */
  registradoPor: string;
  registradoEn: MarcaDeTiempo;
  anulacion: Anulacion | null;
}

/** Derivado del calendario. No se almacena (RN-05). */
export interface Periodo {
  indice: number;
  fechaVencimiento: FechaCivil;
}
