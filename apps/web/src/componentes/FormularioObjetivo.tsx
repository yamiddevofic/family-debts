import type { Advertencia, EstadoGrupo, EstadoObjetivo } from '@deudas/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorApi, RequiereConfirmacion, api } from '../api.ts';
import { aMoneda, deTextoAMonto } from '../formato.ts';
import { AvisoDeCambio } from './AvisoDeCambio.tsx';

/**
 * Crear y editar un objetivo — HU-03, HU-04, HU-08 y RF-16.
 *
 * El mismo formulario para las dos cosas a propósito: editar un objetivo es volver a
 * responder las mismas preguntas, y tener dos formularios distintos garantiza que un día
 * validen cosas distintas.
 *
 * Solo hay reparto en partes iguales: los porcentajes y los montos fijos llegan en el
 * Incremento 4. Es un recorte de alcance, no de corrección (Artículo X).
 */
export function FormularioObjetivo({
  token,
  estado,
  objetivo,
  alCerrar,
}: {
  token: string;
  estado: EstadoGrupo;
  /** Presente al editar; ausente al crear. */
  objetivo?: EstadoObjetivo;
  alCerrar: () => void;
}) {
  const moneda = estado.moneda;
  const editando = objetivo !== undefined;
  const activos = estado.miembros.filter((m) => m.activo);
  const nombreDe = (id: string) => estado.miembros.find((m) => m.id === id)?.nombre ?? 'Alguien';

  const [nombre, setNombre] = useState(objetivo?.nombre ?? '');
  const [montoTexto, setMontoTexto] = useState(objetivo ? String(objetivo.montoTotal) : '');
  const [porCuotas, setPorCuotas] = useState(objetivo?.modalidad === 'CUOTAS_PERIODICAS');
  const [fechaInicio, setFechaInicio] = useState<string>(objetivo?.fechaInicio ?? estado.fechaReferencia);
  const [fechaLimite, setFechaLimite] = useState<string>(objetivo?.fechaLimite ?? '');
  const [elegidos, setElegidos] = useState<string[]>(
    // Al editar se conservan los involucrados actuales aunque alguno esté inactivo: sacarlo
    // en silencio sería justo el cambio que RN-11 obliga a advertir.
    objetivo ? objetivo.involucrados.map((i) => i.miembroId) : activos.map((m) => m.id),
  );
  const [advertencias, setAdvertencias] = useState<Advertencia[]>([]);

  const clienteConsultas = useQueryClient();
  const monto = deTextoAMonto(montoTexto, moneda);

  const cuerpo = (confirmado: boolean) => ({
    nombre: nombre.trim(),
    montoTotal: monto,
    modalidad: porCuotas ? 'CUOTAS_PERIODICAS' : 'REPARTO_UNICO',
    ...(porCuotas
      ? { periodicidad: 'MENSUAL', fechaInicio, fechaLimite }
      : { fechaLimite: fechaLimite || '' }),
    involucrados: elegidos,
    ...(editando ? { version: objetivo.version, confirmado } : {}),
  });

  const crear = useMutation({
    mutationFn: (confirmado: boolean) =>
      editando
        ? api.editarObjetivo(token, objetivo.objetivoId, cuerpo(confirmado))
        : api.crearObjetivo(token, cuerpo(false)),
    onSuccess: async () => {
      await clienteConsultas.invalidateQueries({ queryKey: ['estado', token] });
      alCerrar();
    },
    onError: (error) => {
      // RN-11: el servidor devolvió quién quedaría con saldo a favor. No es un fallo, es
      // información que hay que poner delante antes de dejar guardar.
      if (error instanceof RequiereConfirmacion) setAdvertencias(error.advertencias);
    },
  });

  const listaDeMiembros = editando
    ? estado.miembros.filter((m) => m.activo || elegidos.includes(m.id))
    : activos;

  const alternar = (id: string) =>
    setElegidos((previos) => (previos.includes(id) ? previos.filter((x) => x !== id) : [...previos, id]));

  const listo = nombre.trim() !== '' && monto !== null && monto > 0 && elegidos.length > 0;
  const porCabeza = listo && monto !== null ? Math.floor(monto / elegidos.length) : 0;

  return (
    <form
      className="tarjeta"
      onSubmit={(evento) => {
        evento.preventDefault();
        setAdvertencias([]);
        if (listo) crear.mutate(false);
      }}
    >
      <h2 className="tarjeta__titulo">{editando ? `Editar ${objetivo.nombre}` : 'Nuevo objetivo'}</h2>

      <div className="campo">
        <label htmlFor="obj-nombre">¿Para qué es?</label>
        <input
          id="obj-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nevera, recibo de la luz, arreglo del techo"
          required
        />
      </div>

      <div className="campo">
        <label htmlFor="obj-monto">¿Cuánto cuesta en total?</label>
        <input
          id="obj-monto"
          inputMode="numeric"
          value={montoTexto}
          onChange={(e) => setMontoTexto(e.target.value)}
          placeholder="1.200.000"
          required
        />
        {monto !== null && monto > 0 && <p className="ayuda">{aMoneda(monto, moneda)}</p>}
      </div>

      <fieldset className="grupo-campos">
        <legend>¿Cómo se junta?</legend>
        <label className="opcion opcion--alta">
          <input type="radio" name="modalidad" checked={!porCuotas} onChange={() => setPorCuotas(false)} />
          <span>
            <strong>Monto total repartido</strong>
            <br />
            <span className="pequeno suave">"La nevera cuesta $1.200.000 entre estos cuatro."</span>
          </span>
        </label>
        <label className="opcion opcion--alta">
          <input type="radio" name="modalidad" checked={porCuotas} onChange={() => setPorCuotas(true)} />
          <span>
            <strong>Cuotas mensuales hasta una fecha</strong>
            <br />
            <span className="pequeno suave">"Juntamos $900.000 para el techo, de aquí a diciembre."</span>
          </span>
        </label>
      </fieldset>

      {porCuotas ? (
        <div className="pareja">
          <div className="campo">
            <label htmlFor="obj-inicio">Primera cuota</label>
            <input
              id="obj-inicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="obj-limite">Última cuota</label>
            <input
              id="obj-limite"
              type="date"
              value={fechaLimite}
              onChange={(e) => setFechaLimite(e.target.value)}
              required
            />
          </div>
        </div>
      ) : (
        <div className="campo">
          <label htmlFor="obj-limite-unico">Fecha límite (opcional)</label>
          <input
            id="obj-limite-unico"
            type="date"
            value={fechaLimite}
            onChange={(e) => setFechaLimite(e.target.value)}
          />
          <p className="ayuda">Sin fecha límite, este objetivo nunca aparece en mora.</p>
        </div>
      )}

      <fieldset className="grupo-campos">
        <legend>¿Entre quiénes?</legend>
        {listaDeMiembros.map((miembro) => (
          <label key={miembro.id} className="opcion">
            <input
              type="checkbox"
              checked={elegidos.includes(miembro.id)}
              onChange={() => alternar(miembro.id)}
            />
            <span>
              {miembro.nombre}
              {!miembro.activo && <span className="suave pequeno"> (inactiva)</span>}
            </span>
          </label>
        ))}
        <p className="ayuda">
          Se reparte en partes iguales. Los porcentajes y los montos fijos llegan más adelante.
        </p>
        {porCabeza > 0 && (
          <p className="ayuda">
            A cada uno le tocarían unos {aMoneda(porCabeza, moneda)}
            {monto !== null && monto % elegidos.length !== 0 && ' (con un peso de diferencia para algunos)'}.
          </p>
        )}
      </fieldset>

      {crear.isError && !(crear.error instanceof RequiereConfirmacion) && (
        <div className="aviso aviso--error" role="alert">
          {crear.error instanceof ErrorApi && crear.error.problemas.length > 0
            ? crear.error.problemas.map((p) => p.mensaje).join(' ')
            : crear.error instanceof ErrorApi
              ? crear.error.message
              : `No se pudo ${editando ? 'guardar' : 'crear'} el objetivo.`}
        </div>
      )}

      {advertencias.length > 0 ? (
        <AvisoDeCambio
          advertencias={advertencias}
          moneda={moneda}
          nombreDe={nombreDe}
          guardando={crear.isPending}
          onConfirmar={() => crear.mutate(true)}
          onCancelar={() => setAdvertencias([])}
        />
      ) : (
        <div className="fila">
          <button type="submit" className="boton--principal" disabled={!listo || crear.isPending}>
            {crear.isPending ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear objetivo'}
          </button>
          <button type="button" onClick={alCerrar} disabled={crear.isPending}>
            Cancelar
          </button>
        </div>
      )}
    </form>
  );
}
