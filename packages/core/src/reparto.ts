import { minor } from './dinero.js';
import type { Id, Involucrado, Minor } from './tipos.js';

/**
 * Reparto — RN-01, RN-04 y RN-06.
 *
 * **Este es el único módulo del proyecto autorizado a dividir o multiplicar dinero.** Una
 * regla de ESLint lo hace cumplir en todos los demás archivos (Artículo III, DT-04). El
 * privilegio está aquí porque aquí, y solo aquí, el residuo se distribuye en vez de
 * perderse: la suma de las partes iguala el total exactamente, siempre (INV-02).
 *
 * El método es el del **mayor resto** (RN-04): parte entera truncada para todos, y el
 * residuo —siempre menor que el número de participantes— se reparte de a una unidad mínima
 * empezando por quien tenga el mayor resto fraccionario. Los empates se rompen por `orden`
 * y luego por clave, de modo que la misma entrada produce el mismo reparto hoy y dentro de
 * un año. Sin ese desempate el reparto sería correcto pero no reproducible, y una cifra que
 * cambia sola es exactamente lo que destruye la confianza de la familia.
 */

export class ErrorDeReparto extends Error {
  readonly codigo: string;
  readonly diferencia: number;

  constructor(codigo: string, mensaje: string, diferencia = 0) {
    super(mensaje);
    this.name = 'ErrorDeReparto';
    this.codigo = codigo;
    this.diferencia = diferencia;
  }
}

/** Un participante del reparto, con el peso que le toca y su criterio de desempate. */
export interface Pesado {
  clave: string;
  peso: number;
  orden: number;
}

export interface ParteAsignada {
  miembroId: Id;
  montoDebido: Minor;
}

/**
 * Reparte `total` entre `items` proporcionalmente a sus pesos, con el método del mayor
 * resto. La aritmética es entera de punta a punta: el "resto fraccionario" se compara como
 * `total × peso mod sumaPesos`, sin tocar coma flotante en ningún momento.
 */
export function repartirPorPesos(total: Minor, items: Pesado[]): Map<string, Minor> {
  const asignado = new Map<string, Minor>();
  if (items.length === 0) return asignado;

  const sumaPesos = items.reduce((acumulado, item) => acumulado + item.peso, 0);

  // Todos los pesos en cero (p. ej. porcentajes de 0 pb): nadie debe nada. Solo es
  // coherente si tampoco hay nada que repartir.
  if (sumaPesos === 0) {
    if (total !== 0) {
      throw new ErrorDeReparto(
        'PESOS_EN_CERO',
        `No se puede repartir ${String(total)} entre participantes cuyos pesos suman cero.`,
        total,
      );
    }
    for (const item of items) asignado.set(item.clave, minor(0));
    return asignado;
  }

  const conResto = items.map((item) => {
    const producto = total * item.peso;
    return {
      ...item,
      entero: Math.floor(producto / sumaPesos),
      resto: producto % sumaPesos,
    };
  });

  let repartido = 0;
  for (const item of conResto) repartido += item.entero;
  let residuo = total - repartido;

  // RN-04: mayor resto primero; a igualdad, menor `orden`; a igualdad, clave ascendente.
  const porPrioridad = [...conResto].sort(
    (a, b) => b.resto - a.resto || a.orden - b.orden || (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0),
  );

  const extra = new Map<string, number>();
  for (const item of porPrioridad) {
    if (residuo <= 0) break;
    extra.set(item.clave, 1);
    residuo -= 1;
  }

  for (const item of conResto) {
    asignado.set(item.clave, minor(item.entero + (extra.get(item.clave) ?? 0)));
  }
  return asignado;
}

/**
 * Obligación de cada involucrado en un objetivo (RF-08).
 *
 * En esta versión solo está disponible el reparto `IGUAL` (RN-01). Los porcentajes (RN-02)
 * y los montos fijos (RN-03) llegan en el Incremento 4; hasta entonces se rechazan de forma
 * explícita en vez de aproximarse, porque inventar un acuerdo es peor que no tenerlo.
 */
export function repartir(total: Minor, involucrados: Involucrado[]): ParteAsignada[] {
  if (involucrados.length === 0) {
    throw new ErrorDeReparto('SIN_INVOLUCRADOS', 'Un objetivo sin involucrados no reparte nada (CB-02).');
  }

  const noSoportado = involucrados.find((i) => i.tipoParte !== 'IGUAL');
  if (noSoportado) {
    throw new ErrorDeReparto(
      'TIPO_DE_REPARTO_NO_DISPONIBLE',
      `El reparto por ${noSoportado.tipoParte === 'PORCENTAJE' ? 'porcentajes (RN-02)' : 'montos fijos (RN-03)'} ` +
        'llega en el Incremento 4. Por ahora el reparto es en partes iguales.',
    );
  }

  const asignado = repartirPorPesos(
    total,
    involucrados.map((i) => ({ clave: i.miembroId, peso: 1, orden: i.orden })),
  );

  return involucrados.map((i) => ({
    miembroId: i.miembroId,
    montoDebido: asignado.get(i.miembroId) ?? minor(0),
  }));
}

/**
 * Reparte la obligación de un involucrado entre los `n` periodos de un objetivo de cuotas
 * (RN-06). El desempate es por índice ascendente: los periodos tempranos cargan el peso
 * extra, que es lo que la gente espera cuando una cuota "no da exacta".
 */
export function repartirEnPeriodos(obligacion: Minor, nPeriodos: number): Minor[] {
  if (!Number.isInteger(nPeriodos) || nPeriodos < 1) {
    throw new ErrorDeReparto(
      'PERIODOS_INVALIDOS',
      `Un objetivo de cuotas necesita al menos un periodo; se recibió ${String(nPeriodos)}.`,
    );
  }
  const items: Pesado[] = [];
  for (let indice = 0; indice < nPeriodos; indice += 1) {
    items.push({ clave: String(indice), peso: 1, orden: indice });
  }
  const asignado = repartirPorPesos(obligacion, items);
  return items.map((item) => asignado.get(item.clave) ?? minor(0));
}
