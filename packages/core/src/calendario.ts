import { comparar, esAnterior, sumarMeses } from './fecha.js';
import type { FechaCivil, Periodo } from './tipos.js';

/**
 * Calendario — RN-05.
 *
 * Los periodos de un objetivo de cuotas no se capturan: se derivan de `fechaInicio` y
 * `fechaLimite`. El número de cuotas `N` es una consecuencia de las dos fechas, y por eso
 * no puede desincronizarse de ellas (Artículo IV).
 */

export class ErrorDeCalendario extends Error {
  readonly codigo: string;

  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeCalendario';
    this.codigo = codigo;
  }
}

/**
 * Periodos mensuales desde `inicio` hasta `limite`, ambos incluidos.
 *
 * El día de vencimiento es el de `fechaInicio`, recortado al último día del mes cuando ese
 * día no existe: inicio el 31 de enero vence el 28/29 de febrero, el 31 de marzo, el 30 de
 * abril. El recorte no se arrastra —el día de referencia sigue siendo el 31— porque quien
 * acordó pagar "el último día" no acordó pagar el 28 para siempre.
 */
export function generarPeriodos(inicio: FechaCivil, limite: FechaCivil): Periodo[] {
  if (esAnterior(limite, inicio)) {
    throw new ErrorDeCalendario(
      'LIMITE_ANTERIOR_A_INICIO',
      `La fecha límite (${limite}) es anterior a la de inicio (${inicio}): no hay periodos que generar (RN-05).`,
    );
  }

  const periodos: Periodo[] = [];
  for (let indice = 0; ; indice += 1) {
    const fechaVencimiento = sumarMeses(inicio, indice);
    if (comparar(fechaVencimiento, limite) > 0) break;
    periodos.push({ indice, fechaVencimiento });
  }

  // Inicio y límite en el mismo mes dan exactamente un periodo (CB-09).
  return periodos;
}
