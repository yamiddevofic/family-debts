import type { FechaCivil } from '@deudas/core';

/**
 * El reloj y los identificadores viven aquí, fuera del núcleo (Artículo II, DT-12).
 *
 * La fecha civil se calcula en la zona horaria del grupo, no en UTC: si el servidor está en
 * Londres, a las 8 de la noche en Bogotá "hoy" seguiría siendo hoy, no mañana. Una mora que
 * aparece cinco horas antes de tiempo convierte en moroso a quien no lo es.
 */

export const ZONA_POR_DEFECTO = process.env.ZONA_HORARIA ?? 'America/Bogota';

export interface Reloj {
  /** Fecha civil de hoy, para usar como `fechaReferencia` del núcleo. */
  hoy(): FechaCivil;
  /** Marca de tiempo real en UTC, para `registradoEn` y `anuladoEn`. */
  ahora(): string;
  nuevoId(): string;
}

export function relojDelSistema(zona = ZONA_POR_DEFECTO): Reloj {
  const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return {
    // `en-CA` produce exactamente AAAA-MM-DD, que es el formato de DT-11.
    hoy: () => formato.format(new Date()) as FechaCivil,
    ahora: () => new Date().toISOString(),
    nuevoId: () => crypto.randomUUID(),
  };
}
