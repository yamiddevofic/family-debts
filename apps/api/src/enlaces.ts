import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Enlaces de acceso — DT-09, RN-17 y RNF-06.
 *
 * El enlace **es** la credencial: quien lo tiene es de la familia (SUP-01). Por eso lleva
 * 160 bits de aleatoriedad criptográfica, muy por encima de los 128 que exige RNF-06.
 *
 * En la base no se guarda el token sino su SHA-256, por el mismo razonamiento que con una
 * contraseña: si alguien se lleva el archivo `.db`, no obtiene enlaces utilizables. El
 * precio es que el token se muestra **una sola vez** y no hay "recuperar mi enlace"; a
 * cambio, existe la rotación (RF-03).
 */

/** 20 bytes = 160 bits, en base64url: 27 caracteres sin nada que escapar en una URL. */
export function generarToken(): string {
  return randomBytes(20).toString('base64url');
}

export function hashDeToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Comparación en tiempo constante, para no filtrar el prefijo correcto por el reloj. */
export function hashesIguales(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Enmascara un token para que nunca aparezca completo en un registro (RNF-06, T-029).
 * Se conservan cuatro caracteres para poder correlacionar peticiones sin poder usarlas.
 */
export function enmascarar(token: string): string {
  if (token.length <= 4) return '····';
  return `${token.slice(0, 4)}····`;
}

/** Reemplaza cualquier token que aparezca dentro de una ruta antes de registrarla. */
export function rutaSinToken(ruta: string): string {
  return ruta.replace(/\/g\/[A-Za-z0-9_-]{8,}/g, (coincidencia) => {
    const token = coincidencia.slice(3);
    return `/g/${enmascarar(token)}`;
  });
}
