import type { EstadoGrupo } from '@deudas/core';
import { aMoneda, porcentaje } from '../formato.ts';

/**
 * HU-06 — "arriba del todo, lo mío".
 *
 * El criterio de éxito 2 de la spec es que un familiar que no creó el grupo responda "¿cuánto
 * debo?" sin preguntarle a nadie. Por eso esta cifra va primero, en grande y antes que
 * cualquier total del grupo: la pregunta que trae a la gente a la app es la suya.
 */
export function LoMio({ estado, miembroId }: { estado: EstadoGrupo; miembroId: string }) {
  const resumen = estado.porMiembro.find((m) => m.miembroId === miembroId);
  const moneda = estado.moneda;

  if (!resumen) {
    return (
      <section className="tarjeta">
        <h2 className="tarjeta__titulo">El grupo</h2>
        <TotalesDelGrupo estado={estado} />
      </section>
    );
  }

  const conDeuda = resumen.objetivos.filter((o) => o.debe > 0);
  const conFavor = resumen.objetivos.filter((o) => o.aFavor > 0);

  return (
    <section className="tarjeta tarjeta--mia" aria-labelledby="lo-mio">
      <h2 id="lo-mio" className="tarjeta__titulo">
        Lo mío
      </h2>

      {resumen.debeTotal === 0 ? (
        <p className="cifra cifra--bien cifra--grande">
          ✓ Estás al día
        </p>
      ) : (
        <>
          <p className="sin-margen-abajo">
            Debes en total{' '}
            <span className="cifra cifra--debe cifra--grande">
              {aMoneda(resumen.debeTotal, moneda)}
            </span>
          </p>
          {resumen.enMora && (
            <p>
              <span className="etiqueta etiqueta--mora">⚠ Con cuotas vencidas</span>
            </p>
          )}
          <ul className="lista-simple">
            {conDeuda.map((objetivo) => (
              <li key={objetivo.objetivoId}>
                {objetivo.nombre}: <strong>{aMoneda(objetivo.debe, moneda)}</strong>
                {objetivo.enMora && ' ⚠'}
              </li>
            ))}
          </ul>
        </>
      )}

      {conFavor.length > 0 && (
        <p className="pequeno">
          <span className="etiqueta etiqueta--favor">A favor</span>{' '}
          {conFavor.map((o) => `${o.nombre}: ${aMoneda(o.aFavor, moneda)}`).join(' · ')}
          <br />
          <span className="suave">
            El saldo a favor se queda en ese objetivo: moverlo a otro es una decisión de la
            familia, no del sistema.
          </span>
        </p>
      )}

      <hr className="separador" />
      <TotalesDelGrupo estado={estado} />
    </section>
  );
}

function TotalesDelGrupo({ estado }: { estado: EstadoGrupo }) {
  const avance = porcentaje(estado.totalRecaudado, estado.totalNecesario);
  return (
    <div>
      <div className="entre pequeno">
        <span className="suave">Entre todos</span>
        <span>
          <strong>{aMoneda(estado.totalRecaudado, estado.moneda)}</strong>
          <span className="suave"> de {aMoneda(estado.totalNecesario, estado.moneda)}</span>
        </span>
      </div>
      <div
        className="barra"
        role="progressbar"
        aria-valuenow={avance}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance del grupo"
      >
        <span style={{ width: `${String(avance)}%` }} />
      </div>
      <p className="pequeno suave">
        Falta {aMoneda(estado.totalFaltante, estado.moneda)}.
      </p>
    </div>
  );
}
