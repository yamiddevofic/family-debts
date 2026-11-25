import type { Advertencia, Moneda } from '@deudas/core';
import { aMoneda } from '../formato.ts';

/**
 * RN-11.3 y RN-11.4 — lo que el sistema tiene que decir **antes** de aplicar un cambio.
 *
 * No es un "¿estás seguro?". Un aviso genérico no informa de nada y la gente aprende a
 * darle a aceptar sin leer. Este lista, con nombre y monto, exactamente a quién le queda
 * dinero de más si el cambio se confirma, que es la información que permite decidir.
 */
export function AvisoDeCambio({
  advertencias,
  moneda,
  nombreDe,
  onConfirmar,
  onCancelar,
  guardando,
}: {
  advertencias: Advertencia[];
  moneda: Moneda;
  nombreDe: (id: string) => string;
  onConfirmar: () => void;
  onCancelar: () => void;
  guardando: boolean;
}) {
  return (
    <div className="aviso aviso--ojo" role="alert">
      <h4 className="aviso__titulo">Antes de guardar, revisa esto</h4>
      <ul className="lista-avisos">
        {advertencias.map((advertencia, indice) => (
          <li key={`${advertencia.tipo}-${advertencia.miembroId ?? indice}`}>
            {advertencia.miembroId ? (
              <>
                <strong>{nombreDe(advertencia.miembroId)}</strong>:{' '}
                <span className="cifra cifra--favor">{aMoneda(advertencia.monto, moneda)}</span> a favor.{' '}
              </>
            ) : (
              <>
                <span className="cifra cifra--favor">{aMoneda(advertencia.monto, moneda)}</span> de más.{' '}
              </>
            )}
            <span className="suave">{advertencia.mensaje}</span>
          </li>
        ))}
      </ul>
      <p className="pequeno">
        Ningún aporte se borra ni se mueve: el dinero queda registrado como saldo a favor dentro de
        este objetivo, y la familia decide qué hacer con él.
      </p>
      <div className="fila">
        <button type="button" className="boton--principal" onClick={onConfirmar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Entiendo, guardar igual'}
        </button>
        <button type="button" onClick={onCancelar} disabled={guardando}>
          Volver a editar
        </button>
      </div>
    </div>
  );
}
