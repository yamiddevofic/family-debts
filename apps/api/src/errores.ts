import type { Problema } from '@deudas/core';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Forma única de error de la API, para que la interfaz no tenga que adivinar. */
export interface CuerpoDeError {
  error: { codigo: string; mensaje: string; problemas?: Problema[] };
}

export class ErrorHttp extends Error {
  readonly estado: ContentfulStatusCode;
  readonly codigo: string;
  readonly problemas: Problema[] | undefined;

  constructor(estado: ContentfulStatusCode, codigo: string, mensaje: string, problemas?: Problema[]) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.estado = estado;
    this.codigo = codigo;
    this.problemas = problemas;
  }
}

/**
 * Enlace inválido y recurso de otro grupo responden **lo mismo**: 404.
 *
 * Un 403 confirmaría que el grupo existe, y eso ya es información que quien tiene un enlace
 * ajeno no debería obtener (T-023, RNF-06).
 */
export function noEncontrado(): ErrorHttp {
  return new ErrorHttp(404, 'NO_ENCONTRADO', 'No encontramos nada en este enlace.');
}

export function soloLectura(): ErrorHttp {
  return new ErrorHttp(
    403,
    'ENLACE_DE_SOLO_LECTURA',
    'Este enlace es de consulta: permite ver todo y modificar nada. Pide el enlace de edición.',
  );
}

/**
 * RN-18 y DT-10 — dos personas editaron el mismo objetivo a la vez.
 *
 * La segunda escritura no pisa a la primera: se rechaza y se pide recargar. En una casa esto
 * pasa poco, pero cuando pasa, perder el cambio de alguien sin avisar es exactamente el tipo
 * de cosa que hace desconfiar de la app.
 */
export function conflictoDeVersion(): ErrorHttp {
  return new ErrorHttp(
    409,
    'CONFLICTO_DE_VERSION',
    'Alguien más cambió este objetivo mientras lo editabas. Recarga para ver cómo quedó y vuelve a aplicar tu cambio.',
  );
}

export function datosInvalidos(problemas: Problema[]): ErrorHttp {
  return new ErrorHttp(422, 'DATOS_INVALIDOS', 'Hay datos que no cuadran.', problemas);
}

export function cuerpoDeError(error: ErrorHttp): CuerpoDeError {
  return {
    error: {
      codigo: error.codigo,
      mensaje: error.message,
      ...(error.problemas ? { problemas: error.problemas } : {}),
    },
  };
}
