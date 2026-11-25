import type { EstadoAlmacenado, EstadoObjetivo } from '@deudas/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorApi, api } from '../api.ts';

/**
 * Editar, cancelar, archivar y eliminar — RF-16, RF-17, RF-22.
 *
 * Van detrás de un desplegable y no en la tarjeta, por jerarquía: la acción que trae a la
 * gente a esta pantalla es registrar un aporte, y poner "Eliminar" al mismo peso visual que
 * "Registrar aporte" invita al error en una interfaz que se usa con el pulgar.
 *
 * Eliminar solo aparece cuando de verdad se puede (RN-16): un objetivo con aportes se
 * cancela o se archiva. Ofrecer un botón que siempre falla enseña a ignorar los errores.
 */
export function AccionesObjetivo({
  token,
  objetivo,
  alEditar,
}: {
  token: string;
  objetivo: EstadoObjetivo;
  alEditar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clienteConsultas = useQueryClient();
  const refrescar = () => clienteConsultas.invalidateQueries({ queryKey: ['estado', token] });

  const sinAportes = objetivo.aportes.length === 0;

  const cambiarEstado = useMutation({
    mutationFn: (estado: EstadoAlmacenado) =>
      api.cambiarEstadoObjetivo(token, objetivo.objetivoId, estado, objetivo.version),
    onSuccess: async () => {
      setAbierto(false);
      setError(null);
      await refrescar();
    },
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo cambiar el estado.'),
  });

  const eliminar = useMutation({
    mutationFn: () => api.eliminarObjetivo(token, objetivo.objetivoId),
    onSuccess: refrescar,
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo eliminar.'),
  });

  const ocupado = cambiarEstado.isPending || eliminar.isPending;

  if (confirmandoBorrado) {
    return (
      <div className="aviso aviso--error" role="alert">
        <h4 className="aviso__titulo">¿Eliminar «{objetivo.nombre}»?</h4>
        <p className="pequeno">
          Nadie ha aportado a este objetivo, así que no se pierde ningún historial. Desaparece el
          acuerdo y quiénes participaban. No se puede deshacer.
        </p>
        <div className="fila">
          <button
            type="button"
            className="boton--peligro-solido"
            onClick={() => eliminar.mutate()}
            disabled={ocupado}
          >
            {eliminar.isPending ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
          <button type="button" onClick={() => setConfirmandoBorrado(false)} disabled={ocupado}>
            No, dejarlo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="acciones">
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        {abierto ? 'Menos' : 'Más'}
      </button>

      {abierto && (
        <div className="acciones__panel">
          <button type="button" onClick={alEditar}>
            Editar objetivo
          </button>

          {objetivo.estado === 'ACTIVO' ? (
            <>
              <button type="button" onClick={() => cambiarEstado.mutate('ARCHIVADO')} disabled={ocupado}>
                Archivar
                <span className="suave pequeno"> — se completó y sale de la vista</span>
              </button>
              <button type="button" onClick={() => cambiarEstado.mutate('CANCELADO')} disabled={ocupado}>
                Cancelar
                <span className="suave pequeno"> — se abandonó y deja de exigirse</span>
              </button>
            </>
          ) : (
            <button type="button" onClick={() => cambiarEstado.mutate('ACTIVO')} disabled={ocupado}>
              Reactivar
              <span className="suave pequeno"> — vuelve a contar en los totales</span>
            </button>
          )}

          {sinAportes ? (
            <button
              type="button"
              className="boton--peligro"
              onClick={() => setConfirmandoBorrado(true)}
              disabled={ocupado}
            >
              Eliminar
            </button>
          ) : (
            <p className="pequeno suave acciones__nota">
              No se puede eliminar: ya tiene aportes registrados y borrarlo perdería el historial.
              Para sacarlo de en medio, archívalo o cancélalo.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="aviso aviso--error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
