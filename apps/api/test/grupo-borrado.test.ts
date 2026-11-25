import { describe, expect, it } from 'vitest';
import { grupoDeEjemplo, montarApi, pedir } from './ayudas.ts';

describe('RN-19 — eliminación de un grupo completo', () => {
  it('HU-09 — con el nombre exacto desaparecen miembros, objetivos y aportes', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    await pedir(ctx, 'POST', `/api/g/${edicion}/aportes`, {
      objetivoId,
      acreditadoA: miembros.Ana,
      monto: 33_334,
      fechaValor: '2026-09-10',
      registradoPor: 'Ana',
    });

    const borrado = await pedir(ctx, 'DELETE', `/api/g/${edicion}/grupo`, { confirmacion: 'Casa' });
    expect(borrado.estado).toBe(204);

    for (const tabla of ['grupo', 'miembro', 'objetivo', 'involucrado', 'aporte']) {
      const fila = ctx.base.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).get() as { n: number };
      expect(fila.n, `la tabla ${tabla} debería quedar vacía`).toBe(0);
    }
  });

  it('CB-19 — los dos enlaces dejan de funcionar de inmediato', async () => {
    const ctx = montarApi();
    const { edicion, lectura } = await grupoDeEjemplo(ctx);
    await pedir(ctx, 'DELETE', `/api/g/${edicion}/grupo`, { confirmacion: 'Casa' });

    expect((await pedir(ctx, 'GET', `/api/g/${edicion}/estado`)).estado).toBe(404);
    expect((await pedir(ctx, 'GET', `/api/g/${lectura}/estado`)).estado).toBe(404);
  });

  it('CB-18 — con el nombre mal escrito no se borra nada', async () => {
    const ctx = montarApi();
    const { edicion } = await grupoDeEjemplo(ctx);

    for (const intento of ['casa', 'CASA', 'Cas', 'Casaa', '', 'otra cosa']) {
      const respuesta = await pedir(ctx, 'DELETE', `/api/g/${edicion}/grupo`, { confirmacion: intento });
      expect(respuesta.estado, `"${intento}" no debería borrar`).toBe(422);
      expect(respuesta.datos.error.problemas[0].codigo).toBe('CONFIRMACION_NO_COINCIDE');
    }

    expect((await pedir(ctx, 'GET', `/api/g/${edicion}/estado`)).estado).toBe(200);
    const fila = ctx.base.prepare('SELECT COUNT(*) AS n FROM aporte').get() as { n: number };
    expect(fila.n).toBe(0);
  });

  it('un espacio de más sí se tolera: la confirmación prueba intención, no mecanografía', async () => {
    const ctx = montarApi();
    const { edicion } = await grupoDeEjemplo(ctx);
    expect((await pedir(ctx, 'DELETE', `/api/g/${edicion}/grupo`, { confirmacion: '  Casa ' })).estado).toBe(
      204,
    );
  });

  it('el mensaje dice cuál es el nombre que hay que escribir', async () => {
    const ctx = montarApi();
    const { edicion } = await grupoDeEjemplo(ctx);
    const respuesta = await pedir(ctx, 'DELETE', `/api/g/${edicion}/grupo`, { confirmacion: 'x' });
    expect(respuesta.datos.error.problemas[0].mensaje).toContain('Casa');
    expect(respuesta.datos.error.problemas[0].mensaje).toMatch(/no se borró nada/i);
  });

  it('HU-09 — el enlace de solo lectura no puede eliminar el grupo', async () => {
    const ctx = montarApi();
    const { lectura } = await grupoDeEjemplo(ctx);
    expect((await pedir(ctx, 'DELETE', `/api/g/${lectura}/grupo`, { confirmacion: 'Casa' })).estado).toBe(403);
  });

  it('INV-01 — borrar un grupo no toca los datos de otro, aunque compartan nombre', async () => {
    const ctx = montarApi();
    const casa = await grupoDeEjemplo(ctx);
    const otra = await grupoDeEjemplo(ctx);

    await pedir(ctx, 'DELETE', `/api/g/${casa.edicion}/grupo`, { confirmacion: 'Casa' });

    // El otro grupo sigue entero, con sus tres miembros y su objetivo.
    const { estado, datos } = await pedir(ctx, 'GET', `/api/g/${otra.edicion}/estado`);
    expect(estado).toBe(200);
    expect(datos.estado.miembros).toHaveLength(3);
    expect(datos.estado.objetivos).toHaveLength(1);

    const grupos = ctx.base.prepare('SELECT COUNT(*) AS n FROM grupo').get() as { n: number };
    expect(grupos.n).toBe(1);
  });
});
