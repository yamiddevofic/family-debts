import type { DesgloseAporte, EstadoGrupo } from '@deudas/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorApi, api } from '../api.ts';
import { aMoneda, aVista } from '../formato.ts';

/**
 * Incremento 2 — el historial del grupo, ordenado y filtrable.
 *
 * Anular deja el aporte tachado y a la vista, con motivo, autor y fecha (RN-13, Artículo V).
 * La alternativa —borrarlo— convertiría cualquier desacuerdo en "alguien cambió algo", que es
 * exactamente la discusión que esta app existe para cerrar.
 */
export function Historial({
  token,
  estado,
  puedeEditar,
  identidad,
}: {
  token: string;
  estado: EstadoGrupo;
  puedeEditar: boolean;
  identidad: { miembroId: string; nombre: string };
}) {
  const [filtroMiembro, setFiltroMiembro] = useState('');
  const [filtroObjetivo, setFiltroObjetivo] = useState('');
  const [anulando, setAnulando] = useState<DesgloseAporte | null>(null);

  const nombreDe = (id: string) => estado.miembros.find((m) => m.id === id)?.nombre ?? 'Alguien';

  const filas = estado.objetivos
    .flatMap((objetivo) =>
      objetivo.aportes.map((aporte) => ({ aporte, objetivoId: objetivo.objetivoId, objetivo: objetivo.nombre })),
    )
    .filter(
      ({ aporte, objetivoId }) =>
        (filtroMiembro === '' || aporte.acreditadoA === filtroMiembro || aporte.pagadoPor === filtroMiembro) &&
        (filtroObjetivo === '' || objetivoId === filtroObjetivo),
    )
    .sort((a, b) =>
      a.aporte.fechaValor === b.aporte.fechaValor
        ? b.aporte.registradoEn.localeCompare(a.aporte.registradoEn)
        : b.aporte.fechaValor.localeCompare(a.aporte.fechaValor),
    );

  return (
    <section>
      <h2>Historial</h2>

      <div className="pareja filtros">
        <div>
          <label htmlFor="filtro-miembro" className="pequeno">Persona</label>
          <select id="filtro-miembro" value={filtroMiembro} onChange={(e) => setFiltroMiembro(e.target.value)}>
            <option value="">Todas</option>
            {estado.miembros.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filtro-objetivo" className="pequeno">Objetivo</label>
          <select id="filtro-objetivo" value={filtroObjetivo} onChange={(e) => setFiltroObjetivo(e.target.value)}>
            <option value="">Todos</option>
            {estado.objetivos.map((o) => (
              <option key={o.objetivoId} value={o.objetivoId}>{o.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="suave">No hay aportes que coincidan.</p>
      ) : (
        <div className="tabla-ancha tabla-apilable-envoltorio">
          <table className="tabla-apilable">
            <caption className="solo-lectores">Aportes registrados, incluidos los anulados</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Objetivo</th>
                <th scope="col">Persona</th>
                <th scope="col" className="n">Monto</th>
                {puedeEditar && <th scope="col"><span className="solo-lectores">Acciones</span></th>}
              </tr>
            </thead>
            <tbody>
              {filas.map(({ aporte, objetivo }) => (
                <tr key={aporte.aporteId} className={aporte.anulado ? 'anulado' : undefined}>
                  <td>{aVista(aporte.fechaValor)}</td>
                  <td data-columna="Objetivo">{objetivo}</td>
                  <td data-columna="Persona">
                    {nombreDe(aporte.acreditadoA)}
                    {aporte.porCuentaDeOtro && (
                      <span className="suave pequeno"> · lo puso {nombreDe(aporte.pagadoPor)}</span>
                    )}
                    {aporte.nota && <span className="suave pequeno"> · {aporte.nota}</span>}
                    {aporte.futuro && <span className="etiqueta etiqueta--neutra"> futuro</span>}
                    {aporte.anulado && (
                      <div className="pequeno suave">
                        Anulado: {aporte.motivoAnulacion}
                      </div>
                    )}
                  </td>
                  <td className="n" data-columna="Monto">
                    {aMoneda(aporte.monto, estado.moneda)}
                  </td>
                  {puedeEditar && (
                    <td className="sin-tachar">
                      {!aporte.anulado && (
                        <button type="button" className="boton--texto" onClick={() => setAnulando(aporte)}>
                          Anular
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="pequeno suave">
        Los aportes anulados siguen aquí, tachados y con su motivo. Nada se borra: es lo que
        permite reconstruir cualquier cifra después.
      </p>

      {anulando && (
        <DialogoAnular
          token={token}
          aporte={anulando}
          moneda={estado.moneda}
          identidad={identidad}
          alCerrar={() => setAnulando(null)}
        />
      )}
    </section>
  );
}

function DialogoAnular({
  token,
  aporte,
  moneda,
  identidad,
  alCerrar,
}: {
  token: string;
  aporte: DesgloseAporte;
  moneda: EstadoGrupo['moneda'];
  identidad: { miembroId: string; nombre: string };
  alCerrar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const clienteConsultas = useQueryClient();

  const anular = useMutation({
    mutationFn: () => api.anularAporte(token, aporte.aporteId, motivo.trim(), identidad.nombre),
    onSuccess: async () => {
      await clienteConsultas.invalidateQueries({ queryKey: ['estado', token] });
      alCerrar();
    },
  });

  return (
    <div
      className="tarjeta zona-riesgo"
      role="dialog"
      aria-modal="false"
      aria-labelledby="titulo-anular"

    >
      <h3 id="titulo-anular">Anular el aporte de {aMoneda(aporte.monto, moneda)}</h3>
      <p className="pequeno suave">
        El aporte no se borra: queda tachado en el historial con tu nombre, la fecha y el motivo.
        No se puede deshacer; si te equivocas al anular, se registra un aporte nuevo que lo explique.
      </p>

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          if (motivo.trim() !== '') anular.mutate();
        }}
      >
        <div className="campo">
          <label htmlFor="motivo-anulacion">¿Por qué se anula?</label>
          <input
            id="motivo-anulacion"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="El monto estaba equivocado"
            autoFocus
            required
          />
          <p className="ayuda">Obligatorio: es lo que va a leer quien revise esto en tres meses.</p>
        </div>

        {anular.isError && (
          <div className="aviso aviso--error" role="alert">
            {anular.error instanceof ErrorApi ? anular.error.message : 'No se pudo anular.'}
          </div>
        )}

        <div className="fila">
          <button type="submit" className="boton--peligro" disabled={motivo.trim() === '' || anular.isPending}>
            {anular.isPending ? 'Anulando…' : 'Anular aporte'}
          </button>
          <button type="button" onClick={alCerrar} disabled={anular.isPending}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
