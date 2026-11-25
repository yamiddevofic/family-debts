import type { EstadoGrupo } from '@deudas/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorApi, api } from '../api.ts';
import { olvidarIdentidad } from '../identidad.ts';

/**
 * Eliminar el grupo entero — RF-23 y RN-19.
 *
 * La única operación del sistema que destruye historial, así que la interfaz está diseñada
 * para que no ocurra por accidente:
 *
 *  · Va plegada al fondo de la pantalla, lejos de todo lo demás.
 *  · Dice **cuántos datos** se pierden, con números concretos, no "todos tus datos".
 *  · Pide **escribir el nombre del grupo**. Un "¿estás seguro?" se acepta sin leer; escribir
 *    un nombre obliga a mirar qué se está borrando.
 *  · El botón está deshabilitado hasta que el nombre coincide, así que no hay ningún
 *    instante en que un toque de más borre el grupo.
 */
export function ZonaDeRiesgo({ token, estado }: { token: string; estado: EstadoGrupo }) {
  const [abierta, setAbierta] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');
  const [borrado, setBorrado] = useState(false);

  const totalAportes = estado.objetivos.reduce((total, o) => total + o.aportes.length, 0);

  const eliminar = useMutation({
    mutationFn: () => api.eliminarGrupo(token, confirmacion),
    onSuccess: () => {
      olvidarIdentidad(token);
      setBorrado(true);
    },
  });

  if (borrado) {
    return (
      <section className="tarjeta">
        <h2 className="tarjeta__titulo">El grupo se eliminó</h2>
        <p>
          Ya no queda nada de «{estado.nombre}»: ni miembros, ni objetivos, ni aportes. Los dos
          enlaces dejaron de funcionar.
        </p>
        <a className="boton boton--principal" href="/">
          Crear un grupo nuevo
        </a>
      </section>
    );
  }

  const coincide = confirmacion.trim() === estado.nombre;

  return (
    <section className="tarjeta zona-riesgo">
      <h2 className="tarjeta__titulo">Eliminar este grupo</h2>

      {!abierta ? (
        <>
          <p className="pequeno suave">
            Borra el grupo entero y todo lo que contiene. No se puede deshacer.
          </p>
          <button type="button" className="boton--peligro" onClick={() => setAbierta(true)}>
            Quiero eliminar el grupo
          </button>
        </>
      ) : (
        <>
          <div className="aviso aviso--error">
            <h4 className="aviso__titulo">Esto es irreversible y no hay respaldo</h4>
            <p className="pequeno sin-margen-abajo">
              Se van a borrar <strong>{estado.miembros.length} personas</strong>,{' '}
              <strong>{estado.objetivos.length} objetivos</strong> y{' '}
              <strong>{totalAportes} aportes</strong>, incluidos los anulados. Los dos enlaces
              dejarán de funcionar para toda la familia, no solo para ti. Nadie de Deudas
              Familiares puede recuperarlo después.
            </p>
          </div>

          <div className="campo">
            <label htmlFor="confirmar-borrado">
              Escribe <strong>{estado.nombre}</strong> para confirmar
            </label>
            <input
              id="confirmar-borrado"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby="ayuda-borrado"
            />
            <p className="ayuda" id="ayuda-borrado">
              Tal cual está escrito arriba, con sus mayúsculas.
            </p>
          </div>

          {eliminar.isError && (
            <div className="aviso aviso--error" role="alert">
              {eliminar.error instanceof ErrorApi && eliminar.error.problemas.length > 0
                ? eliminar.error.problemas.map((p) => p.mensaje).join(' ')
                : eliminar.error instanceof ErrorApi
                  ? eliminar.error.message
                  : 'No se pudo eliminar el grupo.'}
            </div>
          )}

          <div className="acciones-formulario">
            <button
              type="button"
              className="boton--peligro-solido"
              onClick={() => eliminar.mutate()}
              disabled={!coincide || eliminar.isPending}
            >
              {eliminar.isPending ? 'Eliminando…' : 'Eliminar el grupo para siempre'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierta(false);
                setConfirmacion('');
              }}
              disabled={eliminar.isPending}
            >
              Mejor no
            </button>
          </div>
        </>
      )}
    </section>
  );
}
