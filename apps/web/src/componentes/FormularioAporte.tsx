import type { EstadoGrupo, EstadoObjetivo } from '@deudas/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorApi, api } from '../api.ts';
import { aMesCorto, aMoneda, deTextoAMonto } from '../formato.ts';

/**
 * T-034, HU-05 y RNF-03 — registrar un aporte en tres interacciones.
 *
 * Todo viene con el valor más probable ya puesto: se acredita a quien está usando la app, la
 * fecha es hoy, y el monto arranca con lo que esa persona debe. En el caso corriente —"puse
 * mi parte"— es abrir, confirmar y listo.
 *
 * Lo que **no** hace: dar por registrado el aporte antes de que el servidor confirme. Sin red
 * se muestra el error (RG-05). Que alguien crea que su aporte quedó y no sea cierto es peor
 * que pedirle que lo intente de nuevo.
 */
export function FormularioAporte({
  token,
  objetivo,
  estado,
  identidad,
  alCerrar,
}: {
  token: string;
  objetivo: EstadoObjetivo;
  estado: EstadoGrupo;
  identidad: { miembroId: string; nombre: string };
  alCerrar: () => void;
}) {
  const moneda = estado.moneda;
  const involucrados = objetivo.involucrados;
  const yoInvolucrado = involucrados.some((i) => i.miembroId === identidad.miembroId);
  const acreditadoPorDefecto = yoInvolucrado
    ? identidad.miembroId
    : (involucrados[0]?.miembroId ?? '');
  const mio = involucrados.find((i) => i.miembroId === acreditadoPorDefecto);

  const [acreditadoA, setAcreditadoA] = useState(acreditadoPorDefecto);
  const [monto, setMonto] = useState(mio && mio.debe > 0 ? String(mio.debe) : '');
  // `<input type="date">` entrega y espera AAAA-MM-DD, que es justo el formato del núcleo.
  const [fechaValor, setFechaValor] = useState<string>(estado.fechaReferencia);
  const [pagadoPor, setPagadoPor] = useState(acreditadoPorDefecto);
  const [periodoIndice, setPeriodoIndice] = useState<string>('');
  const [nota, setNota] = useState('');
  const [avanzado, setAvanzado] = useState(false);

  const clienteConsultas = useQueryClient();

  const registrar = useMutation({
    mutationFn: () =>
      api.crearAporte(token, {
        objetivoId: objetivo.objetivoId,
        acreditadoA,
        pagadoPor: pagadoPor || acreditadoA,
        monto: deTextoAMonto(monto, moneda),
        fechaValor,
        periodoIndice: periodoIndice === '' ? null : Number(periodoIndice),
        nota: nota.trim() || null,
        registradoPor: identidad.nombre,
      }),
    onSuccess: async () => {
      await clienteConsultas.invalidateQueries({ queryKey: ['estado', token] });
      alCerrar();
    },
  });

  const montoEnMinima = deTextoAMonto(monto, moneda);
  const listo = acreditadoA !== '' && montoEnMinima !== null && montoEnMinima > 0;
  const deudaDelElegido = involucrados.find((i) => i.miembroId === acreditadoA)?.debe ?? 0;
  const excede = montoEnMinima !== null && montoEnMinima > deudaDelElegido;

  return (
    <form
      className="tarjeta tarjeta--anidada"
      
      onSubmit={(evento) => {
        evento.preventDefault();
        if (listo) registrar.mutate();
      }}
    >
      <h4 className="tarjeta__titulo">Registrar aporte en {objetivo.nombre}</h4>

      <div className="campo">
        <label htmlFor={`monto-${objetivo.objetivoId}`}>¿Cuánto?</label>
        <input
          id={`monto-${objetivo.objetivoId}`}
          inputMode="numeric"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0"
          autoFocus
          required
        />
        {montoEnMinima !== null && montoEnMinima > 0 && (
          <p className="ayuda">{aMoneda(montoEnMinima, moneda)}</p>
        )}
        {excede && (
          <p className="ayuda">
            Es más de lo que debe. Se acepta: quedará{' '}
            {aMoneda(montoEnMinima - deudaDelElegido, moneda)} a favor en este objetivo.
          </p>
        )}
      </div>

      <div className="campo">
        <label htmlFor={`acreditado-${objetivo.objetivoId}`}>¿De quién es este aporte?</label>
        <select
          id={`acreditado-${objetivo.objetivoId}`}
          value={acreditadoA}
          onChange={(e) => {
            setAcreditadoA(e.target.value);
            setPagadoPor(e.target.value);
          }}
        >
          {involucrados.map((involucrado) => {
            const miembro = estado.miembros.find((m) => m.id === involucrado.miembroId);
            return (
              <option key={involucrado.miembroId} value={involucrado.miembroId}>
                {miembro?.nombre ?? 'Alguien'}
                {involucrado.debe > 0 ? ` — debe ${aMoneda(involucrado.debe, moneda)}` : ' — al día'}
              </option>
            );
          })}
        </select>
      </div>

      <button
        type="button"
        className="boton--texto"
        aria-expanded={avanzado}
        onClick={() => setAvanzado(!avanzado)}
      >
        {avanzado ? 'Menos opciones' : 'Otra fecha, pagué por otro, o elegir cuota'}
      </button>

      {avanzado && (
        <div className="avanzado">
          <div className="campo">
            <label htmlFor={`fecha-${objetivo.objetivoId}`}>¿Qué día se puso?</label>
            <input
              id={`fecha-${objetivo.objetivoId}`}
              type="date"
              value={fechaValor}
              onChange={(e) => setFechaValor(e.target.value)}
            />
            <p className="ayuda">Puede ser una fecha pasada: registrar es retroactivo.</p>
          </div>

          <div className="campo">
            <label htmlFor={`pagador-${objetivo.objetivoId}`}>¿Quién puso el dinero?</label>
            <select
              id={`pagador-${objetivo.objetivoId}`}
              value={pagadoPor}
              onChange={(e) => setPagadoPor(e.target.value)}
            >
              {estado.miembros.map((miembro) => (
                <option key={miembro.id} value={miembro.id}>
                  {miembro.nombre}
                </option>
              ))}
            </select>
            <p className="ayuda">
              Si alguien pagó por otro, la deuda que baja es la de quien se acredita. No se crea
              ninguna deuda entre las dos personas.
            </p>
          </div>

          {objetivo.periodos.length > 0 && (
            <div className="campo">
              <label htmlFor={`periodo-${objetivo.objetivoId}`}>¿Para qué cuota?</label>
              <select
                id={`periodo-${objetivo.objetivoId}`}
                value={periodoIndice}
                onChange={(e) => setPeriodoIndice(e.target.value)}
              >
                <option value="">La más atrasada (y lo que sobre, a la siguiente)</option>
                {objetivo.periodos.map((periodo) => (
                  <option key={periodo.indice} value={periodo.indice}>
                    {aMesCorto(periodo.fechaVencimiento)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="campo">
            <label htmlFor={`nota-${objetivo.objetivoId}`}>Nota (opcional)</label>
            <input
              id={`nota-${objetivo.objetivoId}`}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Transferencia Nequi"
            />
          </div>
        </div>
      )}

      {registrar.isError && (
        <div className="aviso aviso--error" role="alert">
          <strong>El aporte no quedó registrado.</strong>{' '}
          {registrar.error instanceof ErrorApi
            ? registrar.error.problemas.length > 0
              ? registrar.error.problemas.map((p) => p.mensaje).join(' ')
              : registrar.error.message
            : 'Vuelve a intentarlo.'}
        </div>
      )}

      <div className="fila">
        <button type="submit" className="boton--principal" disabled={!listo || registrar.isPending}>
          {registrar.isPending ? 'Guardando…' : 'Guardar aporte'}
        </button>
        <button type="button" onClick={alCerrar} disabled={registrar.isPending}>
          Cancelar
        </button>
      </div>
      <p className="pequeno suave sin-margen-abajo">
        Quedará registrado a nombre de <strong>{identidad.nombre}</strong>.
      </p>
    </form>
  );
}
