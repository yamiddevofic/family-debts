import type { EstadoGrupo } from '@deudas/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorApi, api } from '../api.ts';
import { aMoneda } from '../formato.ts';
import { ZonaDeRiesgo } from './ZonaDeRiesgo.tsx';

/**
 * HU-02 y RN-14 — las personas del grupo.
 *
 * Eliminar y desactivar no son lo mismo, y la interfaz lo dice antes de que alguien se
 * equivoque: quien tiene aportes no se elimina nunca, porque con él se iría el historial
 * (Artículo V). Cuando el servidor rechaza el borrado, aquí se ofrece la salida real.
 */
export function PanelMiembros({
  token,
  estado,
  puedeEditar,
}: {
  token: string;
  estado: EstadoGrupo;
  puedeEditar: boolean;
}) {
  const [nombre, setNombre] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null);
  const clienteConsultas = useQueryClient();
  const refrescar = () => clienteConsultas.invalidateQueries({ queryKey: ['estado', token] });

  const agregar = useMutation({
    mutationFn: () => api.crearMiembro(token, nombre.trim()),
    onSuccess: async (respuesta) => {
      setNombre('');
      setAviso(
        respuesta.nombreRepetido
          ? `Ya había alguien llamado ${respuesta.miembro.nombre}. Se pueden distinguir, pero quizá convenga un apellido.`
          : null,
      );
      await refrescar();
    },
  });

  const cambiarActivo = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api.actualizarMiembro(token, id, { activo }),
    onSuccess: refrescar,
  });

  const renombrar = useMutation({
    mutationFn: ({ id, nombre: nuevo }: { id: string; nombre: string }) =>
      api.actualizarMiembro(token, id, { nombre: nuevo }),
    onSuccess: async () => {
      setEditando(null);
      await refrescar();
    },
    onError: (error) => setAviso(error instanceof ErrorApi ? error.message : 'No se pudo renombrar.'),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => api.eliminarMiembro(token, id),
    onSuccess: async () => {
      setAviso(null);
      await refrescar();
    },
    onError: (error) => {
      setAviso(error instanceof ErrorApi ? error.message : 'No se pudo eliminar.');
    },
  });

  return (
    <section>
      <h2>Personas</h2>

      {aviso && (
        <div className="aviso aviso--ojo" role="alert">
          {aviso}
        </div>
      )}

      {puedeEditar && (
        <form
          className="tarjeta"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (nombre.trim() !== '') agregar.mutate();
          }}
        >
          <div className="campo">
            <label htmlFor="nuevo-miembro">Agregar a alguien</label>
            <input
              id="nuevo-miembro"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre"
              autoComplete="off"
            />
          </div>
          <button type="submit" className="boton--principal" disabled={agregar.isPending || nombre.trim() === ''}>
            Agregar
          </button>
        </form>
      )}

      {estado.miembros.length === 0 && <p className="suave">Todavía no hay nadie en el grupo.</p>}

      {estado.miembros.map((miembro) => {
        const resumen = estado.porMiembro.find((m) => m.miembroId === miembro.id);
        return (
          <article key={miembro.id} className={`tarjeta${miembro.activo ? '' : ' tarjeta--inactiva'}`}>
            {editando?.id === miembro.id ? (
              <form
                onSubmit={(evento) => {
                  evento.preventDefault();
                  if (editando.nombre.trim() !== '') {
                    renombrar.mutate({ id: miembro.id, nombre: editando.nombre.trim() });
                  }
                }}
              >
                <div className="campo">
                  <label htmlFor={`nombre-${miembro.id}`}>Nombre</label>
                  <input
                    id={`nombre-${miembro.id}`}
                    value={editando.nombre}
                    onChange={(e) => setEditando({ id: miembro.id, nombre: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="fila">
                  <button
                    type="submit"
                    className="boton--principal"
                    disabled={renombrar.isPending || editando.nombre.trim() === ''}
                  >
                    {renombrar.isPending ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button type="button" onClick={() => setEditando(null)} disabled={renombrar.isPending}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="entre">
                <h3 className="sin-margen-abajo">
                  {miembro.nombre}
                  {!miembro.activo && <span className="etiqueta etiqueta--neutra">inactiva</span>}
                </h3>
                {resumen && resumen.debeTotal > 0 && (
                  <span className="cifra cifra--debe">{aMoneda(resumen.debeTotal, estado.moneda)}</span>
                )}
              </div>
            )}

            {resumen && (
              <p className="pequeno suave">
                Ha puesto {aMoneda(resumen.aportadoTotal, estado.moneda)}
                {resumen.aFavorTotal > 0 && ` · ${aMoneda(resumen.aFavorTotal, estado.moneda)} a favor`}
                {resumen.enMora && ' · con cuotas vencidas'}
              </p>
            )}

            {puedeEditar && editando?.id !== miembro.id && (
              <div className="fila">
                <button type="button" onClick={() => setEditando({ id: miembro.id, nombre: miembro.nombre })}>
                  Cambiar nombre
                </button>
                <button
                  type="button"
                  onClick={() => cambiarActivo.mutate({ id: miembro.id, activo: !miembro.activo })}
                  disabled={cambiarActivo.isPending}
                >
                  {miembro.activo ? 'Marcar inactiva' : 'Reactivar'}
                </button>
                <button
                  type="button"
                  className="boton--peligro"
                  onClick={() => eliminar.mutate(miembro.id)}
                  disabled={eliminar.isPending}
                >
                  Eliminar
                </button>
              </div>
            )}

            {puedeEditar && !miembro.activo && (
              <p className="pequeno suave">
                Inactiva significa que no aparece al crear objetivos nuevos. Conserva su historial y
                sigue debiendo lo que deba: desactivar no perdona deudas.
              </p>
            )}
          </article>
        );
      })}

      {puedeEditar && (
        <>
          <hr className="separador" />
          <ZonaDeRiesgo token={token} estado={estado} />
        </>
      )}
    </section>
  );
}
