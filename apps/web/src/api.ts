import type { Advertencia, EstadoAlmacenado, EstadoGrupo, Miembro, Objetivo, Problema } from '@deudas/core';

/**
 * Cliente HTTP. El token del enlace viaja en la ruta, igual que en el enlace que se comparte
 * por WhatsApp; nunca se guarda en el servidor ni se envía a ningún tercero.
 */

export interface RespuestaEstado {
  permiso: 'EDICION' | 'LECTURA';
  estado: EstadoGrupo;
}

export class ErrorApi extends Error {
  readonly estado: number;
  readonly codigo: string;
  readonly problemas: Problema[];

  constructor(estado: number, codigo: string, mensaje: string, problemas: Problema[] = []) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = codigo;
    this.problemas = problemas;
  }
}

/**
 * Un cambio que dejaría a alguien con saldo a favor no es un error: es una decisión que hay
 * que tomar con la información delante (RN-11). Por eso no viaja como `ErrorApi`.
 */
export class RequiereConfirmacion extends Error {
  readonly advertencias: Advertencia[];

  constructor(advertencias: Advertencia[]) {
    super('El cambio necesita confirmación.');
    this.name = 'RequiereConfirmacion';
    this.advertencias = advertencias;
  }
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', ...opciones.headers },
    });
  } catch {
    // RG-05: sin red fallamos de forma visible. Nunca simulamos que el aporte quedó
    // registrado, porque creer que se registró y que no sea cierto es el peor resultado.
    throw new ErrorApi(0, 'SIN_CONEXION', 'No hay conexión. El cambio no se guardó: vuelve a intentarlo.');
  }

  if (respuesta.status === 204) return undefined as T;

  const texto = await respuesta.text();

  // Un error puede llegar sin ser JSON: un proxy caído, una pasarela, una página de error
  // del hosting. Intentar interpretarlo igualmente convertiría un fallo entendible en un
  // `SyntaxError` que no le dice nada a nadie.
  let datos: unknown = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    if (respuesta.ok) {
      throw new ErrorApi(respuesta.status, 'RESPUESTA_ILEGIBLE', 'La respuesta del servidor no se entiende.');
    }
  }

  if (!respuesta.ok) {
    const confirmacion = datos as { requiereConfirmacion?: boolean; advertencias?: Advertencia[] } | null;
    if (confirmacion?.requiereConfirmacion === true) {
      throw new RequiereConfirmacion(confirmacion.advertencias ?? []);
    }
    const cuerpo = datos as { error?: { codigo?: string; mensaje?: string; problemas?: Problema[] } } | null;
    throw new ErrorApi(
      respuesta.status,
      cuerpo?.error?.codigo ?? 'ERROR',
      cuerpo?.error?.mensaje ??
        `El servidor respondió ${String(respuesta.status)} y no explicó por qué. El cambio no se guardó.`,
      cuerpo?.error?.problemas ?? [],
    );
  }
  return datos as T;
}

export interface GrupoCreado {
  grupo: { id: string; nombre: string; moneda: { codigo: string; exponente: number } };
  enlaceEdicion: string;
  enlaceLectura: string;
  advertencia: string;
}

export const api = {
  crearGrupo: (nombre: string, codigoMoneda: string, exponente: number) =>
    pedir<GrupoCreado>('/api/grupos', {
      method: 'POST',
      body: JSON.stringify({ nombre, codigoMoneda, exponente }),
    }),

  estado: (token: string) => pedir<RespuestaEstado>(`/api/g/${token}/estado`),

  rotarEnlace: (token: string, tipo: 'EDICION' | 'LECTURA') =>
    pedir<{ tipo: string; enlace: string; advertencia: string }>(`/api/g/${token}/rotar-enlace`, {
      method: 'POST',
      body: JSON.stringify({ tipo }),
    }),

  eliminarGrupo: (token: string, confirmacion: string) =>
    pedir<void>(`/api/g/${token}/grupo`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmacion }),
    }),

  crearMiembro: (token: string, nombre: string) =>
    pedir<{ miembro: Miembro; nombreRepetido: boolean }>(`/api/g/${token}/miembros`, {
      method: 'POST',
      body: JSON.stringify({ nombre }),
    }),

  actualizarMiembro: (token: string, id: string, cambios: { nombre?: string; activo?: boolean }) =>
    pedir<{ miembro: Miembro }>(`/api/g/${token}/miembros/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(cambios),
    }),

  eliminarMiembro: (token: string, id: string) =>
    pedir<void>(`/api/g/${token}/miembros/${id}`, { method: 'DELETE' }),

  crearObjetivo: (token: string, datos: Record<string, unknown>) =>
    pedir<{ objetivo: Objetivo }>(`/api/g/${token}/objetivos`, {
      method: 'POST',
      body: JSON.stringify(datos),
    }),

  editarObjetivo: (token: string, id: string, datos: Record<string, unknown>) =>
    pedir<{ objetivo: Objetivo; advertencias: Advertencia[] }>(`/api/g/${token}/objetivos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(datos),
    }),

  cambiarEstadoObjetivo: (token: string, id: string, estado: EstadoAlmacenado, version: number) =>
    pedir<{ objetivo: Objetivo }>(`/api/g/${token}/objetivos/${id}/estado`, {
      method: 'POST',
      body: JSON.stringify({ estado, version }),
    }),

  eliminarObjetivo: (token: string, id: string) =>
    pedir<void>(`/api/g/${token}/objetivos/${id}`, { method: 'DELETE' }),

  crearAporte: (token: string, datos: Record<string, unknown>) =>
    pedir<{ aporte: unknown }>(`/api/g/${token}/aportes`, {
      method: 'POST',
      body: JSON.stringify(datos),
    }),

  anularAporte: (token: string, id: string, motivo: string, anuladoPor: string) =>
    pedir<{ aporte: unknown; advertencia: string | null }>(`/api/g/${token}/aportes/${id}/anular`, {
      method: 'POST',
      body: JSON.stringify({ motivo, anuladoPor }),
    }),
};
