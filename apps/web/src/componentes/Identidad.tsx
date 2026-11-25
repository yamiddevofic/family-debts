import type { EstadoGrupo } from '@deudas/core';
import { guardarIdentidad } from '../identidad.ts';

/**
 * T-032, RF-21 y PA-03 — "¿quién eres?" al abrir el enlace.
 *
 * Se guarda en el dispositivo, se puede cambiar cuando se quiera, y la pantalla dice
 * explícitamente que no es autenticación (RN-17). Decirlo importa: si la gente cree que
 * esto identifica de verdad, le va a dar a estos nombres un peso probatorio que no tienen.
 */
export function Identidad({
  token,
  estado,
  alElegir,
}: {
  token: string;
  estado: EstadoGrupo;
  alElegir: (identidad: { miembroId: string; nombre: string }) => void;
}) {
  const elegir = (miembroId: string, nombre: string) => {
    guardarIdentidad(token, miembroId, nombre);
    alElegir({ miembroId, nombre });
  };

  const activos = estado.miembros.filter((m) => m.activo);
  const inactivos = estado.miembros.filter((m) => !m.activo);

  return (
    <main className="envoltorio">
      <h1>{estado.nombre}</h1>
      <h2 className="tarjeta__titulo">¿Quién eres?</h2>
      <p className="suave">
        Para mostrarte primero lo tuyo y para saber quién registró cada aporte. Se guarda solo en
        este teléfono y lo puedes cambiar cuando quieras.
      </p>

      <div className="aviso aviso--ojo">
        Esto <strong>no es una contraseña ni un inicio de sesión</strong>: cualquiera con el enlace
        puede elegir cualquier nombre. Sirve para recordar, no para probar.
      </div>

      {estado.miembros.length === 0 ? (
        <div className="tarjeta">
          <p>Todavía no hay nadie registrado en el grupo.</p>
          <button type="button" className="boton--principal" onClick={() => elegir('', 'Invitado')}>
            Entrar y agregar personas
          </button>
        </div>
      ) : (
        <div className="columna">
          {activos.map((miembro) => (
            <button
              key={miembro.id}
              type="button"
              className="boton-persona"
              onClick={() => elegir(miembro.id, miembro.nombre)}
            >
              {miembro.nombre}
            </button>
          ))}
          {inactivos.length > 0 && (
            <details>
              <summary className="desplegable">
                Personas inactivas ({inactivos.length})
              </summary>
              <div className="columna">
                {inactivos.map((miembro) => (
                  <button key={miembro.id} type="button" onClick={() => elegir(miembro.id, miembro.nombre)}>
                    {miembro.nombre} <span className="suave pequeno">(inactiva)</span>
                  </button>
                ))}
              </div>
            </details>
          )}
          <button type="button" className="boton--texto" onClick={() => elegir('', 'Invitado')}>
            No estoy en la lista, solo quiero mirar
          </button>
        </div>
      )}
    </main>
  );
}
