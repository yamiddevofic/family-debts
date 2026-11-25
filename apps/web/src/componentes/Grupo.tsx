import type { EstadoGrupo } from '@deudas/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorApi, api } from '../api.ts';
import { aVista } from '../formato.ts';
import { leerIdentidad, olvidarIdentidad } from '../identidad.ts';
import { FormularioObjetivo } from './FormularioObjetivo.tsx';
import { Historial } from './Historial.tsx';
import { Identidad } from './Identidad.tsx';
import { LoMio } from './LoMio.tsx';
import { PanelMiembros } from './PanelMiembros.tsx';
import { TarjetaObjetivo } from './TarjetaObjetivo.tsx';

type Seccion = 'tablero' | 'historial' | 'personas';

/** Pantalla principal del grupo — HU-06. */
export function Grupo({ token }: { token: string }) {
  const [identidad, setIdentidad] = useState(() => leerIdentidad(token));
  const [seccion, setSeccion] = useState<Seccion>('tablero');
  const [creandoObjetivo, setCreandoObjetivo] = useState(false);

  const consulta = useQuery({
    queryKey: ['estado', token],
    queryFn: () => api.estado(token),
  });

  if (consulta.isPending) {
    return (
      <main className="envoltorio">
        <p aria-live="polite">Cargando el grupo…</p>
      </main>
    );
  }

  if (consulta.isError) {
    const error = consulta.error;
    const noExiste = error instanceof ErrorApi && error.estado === 404;
    return (
      <main className="envoltorio">
        <h1>{noExiste ? 'Este enlace ya no sirve' : 'No pudimos cargar el grupo'}</h1>
        <div className="aviso aviso--error" role="alert">
          {noExiste
            ? 'El enlace es inválido o fue rotado. Pídele a quien administra el grupo que te comparta el vigente.'
            : error instanceof ErrorApi
              ? error.message
              : 'Algo salió mal.'}
        </div>
        {!noExiste && (
          <button type="button" onClick={() => void consulta.refetch()}>
            Reintentar
          </button>
        )}
      </main>
    );
  }

  const { estado, permiso } = consulta.data;
  const puedeEditar = permiso === 'EDICION';

  if (!identidad) {
    return <Identidad token={token} estado={estado} alElegir={setIdentidad} />;
  }

  const activos = estado.objetivos.filter((o) => o.estado === 'ACTIVO');
  // RN-16: archivados y cancelados salen de la vista principal, no del grupo.
  const guardados = estado.objetivos.filter((o) => o.estado !== 'ACTIVO');

  return (
    <>
      <header className="cabecera">
        <div className="cabecera__fila">
          <div>
            <h1>{estado.nombre}</h1>
            <p className="cabecera__identidad">
              Estás como <strong>{identidad.nombre}</strong>.{' '}
              <button
                type="button"
                className="boton--texto"
                onClick={() => {
                  olvidarIdentidad(token);
                  setIdentidad(null);
                }}
              >
                No soy yo
              </button>
            </p>
          </div>
          {!puedeEditar && <span className="etiqueta etiqueta--neutra">👁 Solo lectura</span>}
        </div>
      </header>

      <main className="envoltorio">
        <LoMio estado={estado} miembroId={identidad.miembroId} />

        <nav className="secciones" aria-label="Secciones">
          {(
            [
              ['tablero', 'Objetivos'],
              ['historial', 'Historial'],
              ['personas', 'Personas'],
            ] as const
          ).map(([clave, texto]) => (
            <button
              key={clave}
              type="button"
              aria-current={seccion === clave ? 'page' : undefined}
              onClick={() => setSeccion(clave)}
            >
              {texto}
            </button>
          ))}
        </nav>

        {seccion === 'tablero' && (
          <Tablero
            token={token}
            estado={estado}
            puedeEditar={puedeEditar}
            identidad={identidad}
            activos={activos}
            guardados={guardados}
            creando={creandoObjetivo}
            setCreando={setCreandoObjetivo}
          />
        )}
        {seccion === 'historial' && (
          <Historial token={token} estado={estado} puedeEditar={puedeEditar} identidad={identidad} />
        )}
        {seccion === 'personas' && (
          <PanelMiembros token={token} estado={estado} puedeEditar={puedeEditar} />
        )}

        <footer className="pie">
          <p>
            Quien tiene el enlace entra sin contraseña. El nombre con el que te identificas sirve
            para recordar quién registró qué, <strong>no es autenticación</strong>.
          </p>
          <p>Cifras calculadas al {aVista(estado.fechaReferencia)}.</p>
        </footer>
      </main>
    </>
  );
}

function Tablero({
  token,
  estado,
  puedeEditar,
  identidad,
  activos,
  guardados,
  creando,
  setCreando,
}: {
  token: string;
  estado: EstadoGrupo;
  puedeEditar: boolean;
  identidad: { miembroId: string; nombre: string };
  activos: EstadoGrupo['objetivos'];
  guardados: EstadoGrupo['objetivos'];
  creando: boolean;
  setCreando: (v: boolean) => void;
}) {
  if (estado.miembros.length === 0) {
    return (
      <div className="aviso aviso--ojo">
        Todavía no hay nadie en el grupo. Empieza por <strong>Personas</strong>: sin miembros no se
        puede repartir nada.
      </div>
    );
  }

  return (
    <>
      {activos.length === 0 && !creando && (
        <div className="aviso aviso--ojo">
          Aún no hay objetivos. Un objetivo es aquello para lo que se junta plata: la nevera, el
          recibo de la luz, el arreglo del techo.
        </div>
      )}

      {puedeEditar &&
        (creando ? (
          <FormularioObjetivo token={token} estado={estado} alCerrar={() => setCreando(false)} />
        ) : (
          <button type="button" className="boton--principal" onClick={() => setCreando(true)}>
            + Nuevo objetivo
          </button>
        ))}

      <h2>
        Objetivos <span className="suave pequeno">({activos.length})</span>
      </h2>

      <div className="rejilla-objetivos">
        {activos.map((objetivo) => (
          <TarjetaObjetivo
            key={objetivo.objetivoId}
            token={token}
            objetivo={objetivo}
            estado={estado}
            puedeEditar={puedeEditar}
            identidad={identidad}
          />
        ))}
      </div>

      {guardados.length > 0 && (
        <details>
          <summary className="desplegable">Archivados y cancelados ({guardados.length})</summary>
          <div className="rejilla-objetivos">
            {guardados.map((objetivo) => (
              <TarjetaObjetivo
                key={objetivo.objetivoId}
                token={token}
                objetivo={objetivo}
                estado={estado}
                puedeEditar={puedeEditar}
                identidad={identidad}
              />
            ))}
          </div>
        </details>
      )}
    </>
  );
}
