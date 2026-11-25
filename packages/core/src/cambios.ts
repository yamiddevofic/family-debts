import { CERO, diferencia, negativo, sumar } from './dinero.js';
import { repartir } from './reparto.js';
import type { Aporte, Id, Involucrado, Minor, Objetivo } from './tipos.js';

/**
 * Cambiar un objetivo que ya tiene aportes — RN-11 y RF-16.
 *
 * La regla es corta y no se negocia: las obligaciones se recalculan desde cero y **ningún
 * aporte se altera, se reasigna ni se borra**. Eso significa que un cambio puede dejar a
 * alguien habiendo puesto más de lo que le toca, y eso es correcto: el hecho de que puso el
 * dinero es un hecho, y el acuerdo cambió después.
 *
 * Lo que no es aceptable es que ocurra en silencio. Estas funciones calculan, **antes** de
 * confirmar, quién quedaría con saldo a favor y quién sale del objetivo llevándose plata ya
 * puesta, para que quien edita lo vea con nombre y monto y decida.
 */

export type TipoDeAdvertencia = 'SALDO_A_FAVOR' | 'INVOLUCRADO_RETIRADO' | 'MONTO_BAJO_LO_APORTADO';

export interface Advertencia {
  tipo: TipoDeAdvertencia;
  miembroId: Id | null;
  /** Cuánto queda a favor de esa persona si el cambio se confirma. */
  monto: Minor;
  mensaje: string;
}

export interface CambioDeObjetivo {
  montoTotal: Minor;
  involucrados: Involucrado[];
}

/** Cuánto tiene puesto cada miembro en un objetivo, sin contar lo anulado (RN-07). */
export function aportadoPorMiembro(objetivoId: Id, aportes: Aporte[]): Map<Id, Minor> {
  const puesto = new Map<Id, Minor>();
  for (const aporte of aportes) {
    if (aporte.objetivoId !== objetivoId || aporte.anulacion !== null) continue;
    puesto.set(aporte.acreditadoA, sumar(puesto.get(aporte.acreditadoA) ?? CERO, aporte.monto));
  }
  return puesto;
}

/**
 * Advertencias que hay que mostrar antes de confirmar un cambio (RN-11.3 y RN-11.4).
 *
 * Devuelve la lista vacía cuando el cambio no deja a nadie con dinero de más, que es el caso
 * corriente: corregir un nombre o subir el monto cuando todavía falta por recaudar.
 */
export function advertenciasDeCambio(
  objetivo: Objetivo,
  cambio: CambioDeObjetivo,
  aportes: Aporte[],
): Advertencia[] {
  const puesto = aportadoPorMiembro(objetivo.id, aportes);
  if (puesto.size === 0) return [];

  const nuevas = new Map(
    cambio.involucrados.length > 0
      ? repartir(cambio.montoTotal, cambio.involucrados).map((p) => [p.miembroId, p.montoDebido])
      : [],
  );
  const siguenDentro = new Set(cambio.involucrados.map((i) => i.miembroId));

  const advertencias: Advertencia[] = [];
  const totalAportado = sumar(...puesto.values());

  // CB-07 — el monto baja por debajo de lo ya recaudado: todos quedan con saldo a favor.
  if (diferencia(cambio.montoTotal, totalAportado) < 0) {
    advertencias.push({
      tipo: 'MONTO_BAJO_LO_APORTADO',
      miembroId: null,
      monto: negativo(diferencia(cambio.montoTotal, totalAportado)),
      mensaje:
        `El nuevo monto es menor de lo que ya se ha puesto. Sobrarían ` +
        `${String(negativo(diferencia(cambio.montoTotal, totalAportado)))} en la unidad mínima, ` +
        'repartidos como saldo a favor. Ningún aporte se toca.',
    });
  }

  for (const [miembroId, aportado] of puesto) {
    // RN-11.4 — retirar a alguien que ya aportó deja su obligación en 0.
    if (!siguenDentro.has(miembroId)) {
      advertencias.push({
        tipo: 'INVOLUCRADO_RETIRADO',
        miembroId,
        monto: aportado,
        mensaje:
          'Sale de este objetivo pero ya había aportado. Su obligación queda en cero y lo que puso ' +
          'se convierte en saldo a favor. El aporte no se borra ni se mueve a otro objetivo.',
      });
      continue;
    }

    // RN-11.3 — queda con `aportado > obligación`.
    const nuevaObligacion = nuevas.get(miembroId) ?? CERO;
    const sobrante = negativo(diferencia(nuevaObligacion, aportado));
    if (sobrante > 0) {
      advertencias.push({
        tipo: 'SALDO_A_FAVOR',
        miembroId,
        monto: sobrante,
        mensaje: 'Quedaría con saldo a favor en este objetivo: ya puso más de lo que le tocaría.',
      });
    }
  }

  return advertencias;
}

/**
 * RN-16 y RF-22 — ¿se puede eliminar este objetivo de verdad?
 *
 * Solo si nadie puso nunca dinero en él. **Un aporte anulado cuenta** (CB-16): sigue siendo
 * historial, y el Artículo V protege el registro, no el saldo. Un objetivo que nadie tocó
 * —creado por error, duplicado, con el nombre mal escrito— no es historial y borrarlo no
 * pierde nada.
 */
export function sePuedeEliminar(objetivoId: Id, aportes: Aporte[]): boolean {
  return !aportes.some((a) => a.objetivoId === objetivoId);
}
