import { describe, expect, it } from 'vitest';
import { grupoDeEjemplo, montarApi, pedir } from './ayudas.ts';

describe('RN-14 — baja de un miembro', () => {
  it('un miembro sin aportes ni objetivos se elimina de verdad (HU-02)', async () => {
    const ctx = montarApi();
    const { datos: creado } = await pedir(ctx, 'POST', '/api/grupos', { nombre: 'Casa' });
    const enlace: string = creado.enlaceEdicion;
    const { datos } = await pedir(ctx, 'POST', `/api/g/${enlace}/miembros`, { nombre: 'Pedro' });

    expect((await pedir(ctx, 'DELETE', `/api/g/${enlace}/miembros/${datos.miembro.id}`)).estado).toBe(204);
    const estado = await pedir(ctx, 'GET', `/api/g/${enlace}/estado`);
    expect(estado.datos.estado.miembros).toHaveLength(0);
  });

  it('un miembro con aportes nunca se elimina: responde 409 y ofrece desactivarlo', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    await pedir(ctx, 'POST', `/api/g/${edicion}/aportes`, {
      objetivoId,
      acreditadoA: miembros.Ana,
      monto: 10_000,
      fechaValor: '2026-09-10',
      registradoPor: 'Ana',
    });

    const intento = await pedir(ctx, 'DELETE', `/api/g/${edicion}/miembros/${miembros.Ana}`);
    expect(intento.estado).toBe(409);
    expect(intento.datos.error.codigo).toBe('MIEMBRO_CON_APORTES');
    expect(intento.datos.error.mensaje).toMatch(/inactiva/i);
  });

  it('un miembro involucrado en un objetivo tampoco se elimina', async () => {
    const ctx = montarApi();
    const { edicion, miembros } = await grupoDeEjemplo(ctx);
    const intento = await pedir(ctx, 'DELETE', `/api/g/${edicion}/miembros/${miembros.Luis}`);
    expect(intento.estado).toBe(409);
    expect(intento.datos.error.codigo).toBe('MIEMBRO_INVOLUCRADO');
  });

  it('desactivar conserva el historial íntegro y no perdona la deuda (CB-12)', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    await pedir(ctx, 'POST', `/api/g/${edicion}/aportes`, {
      objetivoId,
      acreditadoA: miembros.Luis,
      monto: 10_000,
      fechaValor: '2026-09-10',
      registradoPor: 'Luis',
    });

    const baja = await pedir(ctx, 'PATCH', `/api/g/${edicion}/miembros/${miembros.Luis}`, { activo: false });
    expect(baja.datos.miembro.activo).toBe(false);

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const luis = datos.estado.porMiembro.find((m: { miembroId: string }) => m.miembroId === miembros.Luis);
    expect(luis.debeTotal).toBe(23_333);
    expect(luis.aportadoTotal).toBe(10_000);
  });

  it('se puede corregir el nombre de un miembro', async () => {
    const ctx = montarApi();
    const { edicion, miembros } = await grupoDeEjemplo(ctx);
    const { datos } = await pedir(ctx, 'PATCH', `/api/g/${edicion}/miembros/${miembros.Ana}`, {
      nombre: 'Ana María',
    });
    expect(datos.miembro.nombre).toBe('Ana María');
  });

  it('CB-08 — dos miembros con el mismo nombre se permiten, avisando del repetido', async () => {
    const ctx = montarApi();
    const { edicion } = await grupoDeEjemplo(ctx);
    const { estado, datos } = await pedir(ctx, 'POST', `/api/g/${edicion}/miembros`, { nombre: 'Ana' });
    expect(estado).toBe(201);
    expect(datos.nombreRepetido).toBe(true);
  });

  it('un nombre vacío se rechaza', async () => {
    const ctx = montarApi();
    const { edicion } = await grupoDeEjemplo(ctx);
    expect((await pedir(ctx, 'POST', `/api/g/${edicion}/miembros`, { nombre: '  ' })).estado).toBe(422);
  });

  it('con el enlace de lectura no se pueden tocar los miembros', async () => {
    const ctx = montarApi();
    const { lectura, miembros } = await grupoDeEjemplo(ctx);
    expect((await pedir(ctx, 'POST', `/api/g/${lectura}/miembros`, { nombre: 'X' })).estado).toBe(403);
    expect((await pedir(ctx, 'DELETE', `/api/g/${lectura}/miembros/${miembros.Ana}`)).estado).toBe(403);
  });
});
