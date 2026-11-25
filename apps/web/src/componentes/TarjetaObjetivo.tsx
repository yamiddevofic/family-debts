import type { EstadoGrupo, EstadoObjetivo } from '@deudas/core';
import { useState } from 'react';
import { aMesCorto, aMoneda, aVista, porcentaje } from '../formato.ts';
import { AccionesObjetivo } from './AccionesObjetivo.tsx';
import { FormularioAporte } from './FormularioAporte.tsx';
import { FormularioObjetivo } from './FormularioObjetivo.tsx';

/**
 * Un objetivo en el tablero — HU-06, RF-13 y RF-15.
 *
 * Se muestran **`recaudado` y `faltante` a la vez**, aunque no siempre sumen el total: RN-07
 * dice que pueden diferir cuando hay saldo a favor, y reconciliarlas en silencio sería
 * esconder justo la información que explica la diferencia.
 */
export function TarjetaObjetivo({
  token,
  objetivo,
  estado,
  puedeEditar,
  identidad,
}: {
  token: string;
  objetivo: EstadoObjetivo;
  estado: EstadoGrupo;
  puedeEditar: boolean;
  identidad: { miembroId: string; nombre: string };
}) {
  const [abierto, setAbierto] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [editando, setEditando] = useState(false);
  const moneda = estado.moneda;
  const nombreDe = (id: string) => estado.miembros.find((m) => m.id === id)?.nombre ?? 'Alguien';
  const avance = porcentaje(objetivo.recaudado, objetivo.montoTotal);
  const mio = objetivo.involucrados.find((i) => i.miembroId === identidad.miembroId);

  if (editando) {
    return (
      <FormularioObjetivo
        token={token}
        estado={estado}
        objetivo={objetivo}
        alCerrar={() => setEditando(false)}
      />
    );
  }

  const cancelado = objetivo.estado === 'CANCELADO';

  return (
    <article className={`tarjeta${objetivo.estado === 'ACTIVO' ? '' : ' tarjeta--inactiva'}`}>
      <div className="entre">
        <h3>{objetivo.nombre}</h3>
        <div className="fila">
          {objetivo.saldado && <span className="etiqueta etiqueta--saldado">✓ Saldado</span>}
          {objetivo.enMora && <span className="etiqueta etiqueta--mora">⚠ En mora</span>}
          {cancelado && <span className="etiqueta etiqueta--neutra">✕ Cancelado</span>}
          {objetivo.estado === 'ARCHIVADO' && (
            <span className="etiqueta etiqueta--neutra">📦 Archivado</span>
          )}
          {objetivo.modalidad === 'CUOTAS_PERIODICAS' && !cancelado && (
            <span className="etiqueta etiqueta--neutra">{objetivo.periodos.length} cuotas</span>
          )}
        </div>
      </div>

      {cancelado && (
        <p className="pequeno suave">
          Este objetivo se abandonó: ya no se le debe nada a nadie y lo que se puso quedó como saldo
          a favor. Nada se borró.
        </p>
      )}

      {objetivo.descripcion && <p className="pequeno suave">{objetivo.descripcion}</p>}

      <div className="entre pequeno">
        <span>
          <strong>{aMoneda(objetivo.recaudado, moneda)}</strong>
          <span className="suave"> de {aMoneda(objetivo.montoTotal, moneda)}</span>
        </span>
        <span className="suave">Faltan {aMoneda(objetivo.faltante, moneda)}</span>
      </div>
      <div
        className="barra"
        role="progressbar"
        aria-valuenow={avance}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Avance de ${objetivo.nombre}`}
      >
        <span style={{ width: `${String(avance)}%` }} />
      </div>

      {objetivo.fechaLimite && (
        <p className="pequeno suave">Fecha límite: {aVista(objetivo.fechaLimite)}</p>
      )}

      {mio && (
        <p>
          Lo tuyo:{' '}
          {mio.debe > 0 ? (
            <span className="cifra cifra--debe">debes {aMoneda(mio.debe, moneda)}</span>
          ) : mio.aFavor > 0 ? (
            <span className="cifra cifra--favor">{aMoneda(mio.aFavor, moneda)} a favor</span>
          ) : (
            <span className="cifra cifra--bien">al día</span>
          )}
          <span className="suave pequeno"> (te tocan {aMoneda(mio.obligacion, moneda)})</span>
        </p>
      )}

      <div className="fila">
        {puedeEditar && objetivo.estado === 'ACTIVO' && (
          <button type="button" className="boton--principal" onClick={() => setRegistrando(true)}>
            Registrar aporte
          </button>
        )}
        <button type="button" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
          {abierto ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
        {puedeEditar && (
          <AccionesObjetivo token={token} objetivo={objetivo} alEditar={() => setEditando(true)} />
        )}
      </div>

      {registrando && (
        <FormularioAporte
          token={token}
          objetivo={objetivo}
          estado={estado}
          identidad={identidad}
          alCerrar={() => setRegistrando(false)}
        />
      )}

      {abierto && (
        <div>
          <h4>Quién debe qué</h4>
          <div className="tabla-ancha tabla-apilable-envoltorio">
            <table className="tabla-apilable">
              <caption className="solo-lectores">
                Obligación, aportado y saldo de cada involucrado en {objetivo.nombre}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Persona</th>
                  <th scope="col" className="n">Le toca</th>
                  <th scope="col" className="n">Ha puesto</th>
                  <th scope="col" className="n">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {objetivo.involucrados.map((involucrado) => (
                  <tr key={involucrado.miembroId}>
                    <td>
                      {nombreDe(involucrado.miembroId)}
                      {involucrado.enMora && ' ⚠'}
                    </td>
                    <td className="n" data-columna="Le toca">
                      {aMoneda(involucrado.obligacion, moneda)}
                    </td>
                    <td className="n" data-columna="Ha puesto">
                      {aMoneda(involucrado.aportado, moneda)}
                    </td>
                    <td className="n" data-columna="Saldo">
                      {involucrado.debe > 0 ? (
                        <span className="cifra--debe">debe {aMoneda(involucrado.debe, moneda)}</span>
                      ) : involucrado.aFavor > 0 ? (
                        <span className="cifra--favor">{aMoneda(involucrado.aFavor, moneda)} a favor</span>
                      ) : (
                        <span className="cifra--bien">al día</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {objetivo.periodos.length > 0 && (
            <Calendario objetivo={objetivo} estado={estado} identidad={identidad} />
          )}

          <h4>De dónde salen estas cifras</h4>
          {objetivo.aportes.length === 0 ? (
            <p className="pequeno suave">Todavía no hay ningún aporte registrado.</p>
          ) : (
            <div className="tabla-ancha tabla-apilable-envoltorio">
              <table className="tabla-apilable">
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Se le acredita a</th>
                    <th scope="col" className="n">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {objetivo.aportes.map((aporte) => (
                    <tr key={aporte.aporteId} className={aporte.anulado ? 'anulado' : undefined}>
                      <td>{aVista(aporte.fechaValor)}</td>
                      <td className="sin-tachar" data-columna="Quién">
                        {nombreDe(aporte.acreditadoA)}
                        {aporte.porCuentaDeOtro && (
                          <span className="suave pequeno"> · pagó {nombreDe(aporte.pagadoPor)}</span>
                        )}
                        {aporte.futuro && <span className="etiqueta etiqueta--neutra">futuro</span>}
                        {aporte.anulado && (
                          <span className="pequeno suave"> · anulado: {aporte.motivoAnulacion}</span>
                        )}
                      </td>
                      <td className="n" data-columna="Monto">
                        {aMoneda(aporte.monto, moneda)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/** Vista de calendario del Incremento 3: qué toca este mes y qué quedó debiendo. */
function Calendario({
  objetivo,
  estado,
  identidad,
}: {
  objetivo: EstadoObjetivo;
  estado: EstadoGrupo;
  identidad: { miembroId: string; nombre: string };
}) {
  const moneda = estado.moneda;
  const mio = objetivo.involucrados.find((i) => i.miembroId === identidad.miembroId);
  const referencia = mio ?? objetivo.involucrados[0];
  if (!referencia) return null;

  return (
    <>
      <h4>
        Cuotas {mio ? 'tuyas' : `de ${estado.miembros.find((m) => m.id === referencia.miembroId)?.nombre ?? ''}`}
      </h4>
      <div className="tabla-ancha tabla-apilable-envoltorio">
        <table className="tabla-apilable">
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col">Vence</th>
              <th scope="col" className="n">Cuota</th>
              <th scope="col" className="n">Puesto</th>
              <th scope="col" className="n">Falta</th>
            </tr>
          </thead>
          <tbody>
            {referencia.periodos.map((periodo) => (
              <tr key={periodo.indice}>
                <td>
                  {aMesCorto(periodo.fechaVencimiento)}
                  {periodo.enMora && <span className="etiqueta etiqueta--mora">vencida</span>}
                </td>
                <td data-columna="Vence">{aVista(periodo.fechaVencimiento)}</td>
                <td className="n" data-columna="Cuota">
                  {aMoneda(periodo.cuota, moneda)}
                </td>
                <td className="n" data-columna="Puesto">
                  {aMoneda(periodo.aplicado, moneda)}
                </td>
                <td className="n" data-columna="Falta">
                  {periodo.pendiente === 0 ? (
                    <span className="cifra--bien">✓</span>
                  ) : (
                    <span className={periodo.enMora ? 'cifra--debe' : undefined}>
                      {aMoneda(periodo.pendiente, moneda)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pequeno suave">
        Un aporte sin mes indicado se aplica a la cuota pendiente más antigua, y lo que sobra pasa
        a la siguiente.
      </p>
    </>
  );
}
