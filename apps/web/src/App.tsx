import { CrearGrupo } from './componentes/CrearGrupo.tsx';
import { Grupo } from './componentes/Grupo.tsx';

/**
 * Enrutado mínimo: `/` para crear un grupo y `/g/<token>` para verlo.
 *
 * Son dos rutas. Traer una biblioteca de enrutado para dos rutas contradice el Artículo VIII,
 * así que se resuelve leyendo la ruta del navegador.
 */
export function App() {
  const ruta = window.location.pathname;
  const coincidencia = /^\/g\/([A-Za-z0-9_-]+)\/?$/.exec(ruta);

  if (coincidencia?.[1]) return <Grupo token={coincidencia[1]} />;
  return <CrearGrupo />;
}
