/**
 * `@deudas/core` — todo el dominio de Deudas Familiares.
 *
 * Cero dependencias de runtime (Artículo II, DT-03): el mismo código corre en el servidor,
 * en el navegador y en las pruebas. El reloj y los identificadores entran como parámetros;
 * aquí no se llama a `Date.now()` ni a `Math.random()`.
 */
export * from './tipos.js';
export * from './dinero.js';
export * from './fecha.js';
export * from './reparto.js';
export * from './calendario.js';
export * from './imputacion.js';
export * from './estado.js';
export * from './cambios.js';
export * from './validacion.js';
