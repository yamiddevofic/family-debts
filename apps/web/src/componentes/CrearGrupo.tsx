import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorApi, api, type GrupoCreado } from '../api.ts';

/**
 * T-031 y HU-01 — crear un grupo y mostrar los enlaces **una sola vez**.
 *
 * La advertencia va arriba y sin desplazarse, no al pie: si alguien cierra esta pantalla sin
 * copiar el enlace, no hay forma de recuperarlo (DT-09). Es la única pantalla de la app
 * donde perder un dato es irreversible, y tiene que verse así.
 */
export function CrearGrupo() {
  const [nombre, setNombre] = useState('');
  const [moneda, setMoneda] = useState('COP');
  const [creado, setCreado] = useState<GrupoCreado | null>(null);

  const crear = useMutation({
    mutationFn: () => api.crearGrupo(nombre.trim(), moneda, moneda === 'COP' ? 0 : 2),
    onSuccess: setCreado,
  });

  if (creado) return <EnlacesReciénCreados creado={creado} />;

  return (
    <main className="envoltorio">
      <h1>Deudas Familiares</h1>
      <p className="suave">
        Para llevar la cuenta de lo que se paga entre varios en la casa: cuánto cuesta algo, a
        quién le toca cuánto y quién ya puso lo suyo. Sin cuentas ni contraseñas.
      </p>

      <form
        className="tarjeta"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (nombre.trim() !== '') crear.mutate();
        }}
      >
        <h2 className="tarjeta__titulo">Crear un grupo</h2>

        <div className="campo">
          <label htmlFor="nombre">¿Cómo se llama el grupo?</label>
          <input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Casa de los Rodríguez"
            autoComplete="off"
            required
          />
          <p className="ayuda">Lo verá toda la familia al abrir el enlace.</p>
        </div>

        <div className="campo">
          <label htmlFor="moneda">Moneda</label>
          <select id="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
            <option value="COP">Peso colombiano (COP)</option>
            <option value="USD">Dólar (USD)</option>
          </select>
          <p className="ayuda">Se fija ahora y no cambia después.</p>
        </div>

        {crear.isError && (
          <p className="aviso aviso--error" role="alert">
            {crear.error instanceof ErrorApi ? crear.error.message : 'No se pudo crear el grupo.'}
          </p>
        )}

        <button type="submit" className="boton--principal" disabled={crear.isPending || nombre.trim() === ''}>
          {crear.isPending ? 'Creando…' : 'Crear grupo'}
        </button>
      </form>
    </main>
  );
}

function EnlacesReciénCreados({ creado }: { creado: GrupoCreado }) {
  const base = window.location.origin;
  const edicion = `${base}/g/${creado.enlaceEdicion}`;
  const lectura = `${base}/g/${creado.enlaceLectura}`;

  return (
    <main className="envoltorio">
      <h1>{creado.grupo.nombre}</h1>

      <div className="aviso aviso--ojo" role="alert">
        <strong>Copia estos enlaces antes de cerrar.</strong> {creado.advertencia} Guárdalos donde
        los vuelvas a encontrar: en la nota del teléfono o mandándotelos a ti mismo.
      </div>

      <Enlace
        titulo="Enlace de edición"
        descripcion="Para quien registra aportes y crea objetivos. Es el que se comparte con la familia."
        url={edicion}
      />
      <Enlace
        titulo="Enlace de solo lectura"
        descripcion="Deja ver todo y no permite cambiar nada. Útil para quien solo quiere consultar."
        url={lectura}
      />

      <p className="pequeno suave">
        Cualquiera que tenga el enlace entra sin contraseña: compártelo solo con la familia. Si se
        filtra, se puede rotar desde el grupo y el anterior deja de servir.
      </p>

      <a className="boton boton--principal" href={edicion}>
        Entrar al grupo
      </a>
    </main>
  );
}

function Enlace({ titulo, descripcion, url }: { titulo: string; descripcion: string; url: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <section className="tarjeta">
      <h2 className="tarjeta__titulo">{titulo}</h2>
      <p className="pequeno suave">{descripcion}</p>
      <code className="enlace-caja">{url}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2_500);
          });
        }}
      >
        {copiado ? '✓ Copiado' : 'Copiar enlace'}
      </button>
    </section>
  );
}
