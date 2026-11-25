import { describe, expect, it } from 'vitest';
import { enmascarar, generarToken, hashDeToken, rutaSinToken } from '../src/enlaces.ts';
import { grupoDeEjemplo, montarApi, pedir } from './ayudas.ts';

describe('RN-17 — aislamiento y acceso por enlace', () => {
  it('crear un grupo devuelve dos enlaces distintos: edición y solo lectura (HU-01)', async () => {
    const ctx = montarApi();
    const { estado, datos } = await pedir(ctx, 'POST', '/api/grupos', { nombre: 'Casa' });
    expect(estado).toBe(201);
    expect(datos.enlaceEdicion).not.toBe(datos.enlaceLectura);
    expect(datos.advertencia).toMatch(/no se pueden recuperar/i);
  });

  it('RNF-06 — el secreto tiene 160 bits de entropía, por encima del mínimo de 128', () => {
    const token = generarToken();
    expect(token).toHaveLength(27);
    expect(Buffer.from(token, 'base64url')).toHaveLength(20);
    expect(new Set(Array.from({ length: 200 }, () => generarToken())).size).toBe(200);
  });

  it('DT-09 — la base guarda el hash, nunca el token: llevarse el .db no da enlaces', async () => {
    const ctx = montarApi();
    const { datos } = await pedir(ctx, 'POST', '/api/grupos', { nombre: 'Casa' });
    const fila = ctx.base.prepare('SELECT * FROM grupo').get() as Record<string, string>;
    const volcado = JSON.stringify(fila);
    expect(volcado).not.toContain(datos.enlaceEdicion);
    expect(volcado).not.toContain(datos.enlaceLectura);
    expect(fila.hash_enlace_edicion).toBe(hashDeToken(datos.enlaceEdicion));
  });

  it('un enlace inválido responde 404 sin revelar si el grupo existe (T-022)', async () => {
    const ctx = montarApi();
    await grupoDeEjemplo(ctx);
    const { estado, datos } = await pedir(ctx, 'GET', `/api/g/${generarToken()}/estado`);
    expect(estado).toBe(404);
    expect(datos.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('el enlace de solo lectura permite ver todo y modificar nada (HU-01)', async () => {
    const ctx = montarApi();
    const { lectura, miembros, objetivoId } = await grupoDeEjemplo(ctx);

    const consulta = await pedir(ctx, 'GET', `/api/g/${lectura}/estado`);
    expect(consulta.estado).toBe(200);
    expect(consulta.datos.permiso).toBe('LECTURA');
    expect(consulta.datos.estado.objetivos).toHaveLength(1);

    const escritura = await pedir(ctx, 'POST', `/api/g/${lectura}/aportes`, {
      objetivoId,
      acreditadoA: miembros.Ana,
      monto: 10_000,
      fechaValor: '2026-09-10',
      registradoPor: 'Ana',
    });
    expect(escritura.estado).toBe(403);
    expect(escritura.datos.error.mensaje).toMatch(/consulta/i);
  });

  it('RF-03 — al rotar un enlace el anterior deja de funcionar de inmediato (RG-02)', async () => {
    const ctx = montarApi();
    const { edicion } = await grupoDeEjemplo(ctx);

    const rotacion = await pedir(ctx, 'POST', `/api/g/${edicion}/rotar-enlace`, { tipo: 'EDICION' });
    expect(rotacion.estado).toBe(200);
    const nuevo: string = rotacion.datos.enlace;
    expect(nuevo).not.toBe(edicion);

    expect((await pedir(ctx, 'GET', `/api/g/${edicion}/estado`)).estado).toBe(404);
    expect((await pedir(ctx, 'GET', `/api/g/${nuevo}/estado`)).estado).toBe(200);
  });

  it('rotar el enlace de lectura no toca el de edición', async () => {
    const ctx = montarApi();
    const { edicion, lectura } = await grupoDeEjemplo(ctx);
    await pedir(ctx, 'POST', `/api/g/${edicion}/rotar-enlace`, { tipo: 'LECTURA' });
    expect((await pedir(ctx, 'GET', `/api/g/${edicion}/estado`)).estado).toBe(200);
    expect((await pedir(ctx, 'GET', `/api/g/${lectura}/estado`)).estado).toBe(404);
  });

  it('rotar exige enlace de edición: con el de lectura no se puede', async () => {
    const ctx = montarApi();
    const { lectura } = await grupoDeEjemplo(ctx);
    expect((await pedir(ctx, 'POST', `/api/g/${lectura}/rotar-enlace`, { tipo: 'EDICION' })).estado).toBe(403);
  });

  it('T-029 — el token nunca aparece completo en un registro (RNF-06)', async () => {
    const ctx = montarApi();
    const { edicion } = await grupoDeEjemplo(ctx);
    await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    expect(ctx.registros.length).toBeGreaterThan(0);
    for (const linea of ctx.registros) expect(linea).not.toContain(edicion);
    expect(ctx.registros.some((l) => l.includes(enmascarar(edicion)))).toBe(true);
  });

  it('el enmascarado deja correlacionar peticiones sin poder reusar el enlace', () => {
    expect(rutaSinToken('/api/g/AbCdEfGhIjKlMnOpQrStUvWxYz0/estado')).toBe('/api/g/AbCd····/estado');
    expect(rutaSinToken('/api/grupos')).toBe('/api/grupos');
  });

  it('RNF-06 — las páginas de grupo no se indexan y no filtran el enlace por referer', async () => {
    const ctx = montarApi();
    const respuesta = await ctx.app.request('/api/grupos', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Casa' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(respuesta.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(respuesta.headers.get('X-Robots-Tag')).toContain('noindex');
  });
});

describe('RF-20 — varios grupos independientes sin filtración entre ellos', () => {
  it('INV-01 — un enlace válido no alcanza el objetivo de otro grupo: responde 404, no 403', async () => {
    const ctx = montarApi();
    const casa = await grupoDeEjemplo(ctx);
    const otra = await grupoDeEjemplo(ctx);

    // El enlace de "casa" es perfectamente válido; el objetivo pertenece al otro grupo.
    const intento = await pedir(ctx, 'POST', `/api/g/${casa.edicion}/aportes`, {
      objetivoId: otra.objetivoId,
      acreditadoA: otra.miembros.Ana,
      monto: 10_000,
      fechaValor: '2026-09-10',
      registradoPor: 'Ana',
    });
    // 404 y no 403: un 403 confirmaría que ese objetivo existe.
    expect(intento.estado).toBe(404);
  });

  it('el estado de un grupo solo trae sus propios miembros, objetivos y aportes', async () => {
    const ctx = montarApi();
    const casa = await grupoDeEjemplo(ctx);
    const otra = await grupoDeEjemplo(ctx);

    const { datos } = await pedir(ctx, 'GET', `/api/g/${casa.edicion}/estado`);
    const ids = new Set(datos.estado.miembros.map((m: { id: string }) => m.id));
    expect(ids.has(casa.miembros.Ana)).toBe(true);
    expect(ids.has(otra.miembros.Ana)).toBe(false);
    expect(datos.estado.objetivos.map((o: { objetivoId: string }) => o.objetivoId)).toEqual([casa.objetivoId]);
  });

  it('tampoco se puede anular un aporte de otro grupo', async () => {
    const ctx = montarApi();
    const casa = await grupoDeEjemplo(ctx);
    const otra = await grupoDeEjemplo(ctx);

    const { datos } = await pedir(ctx, 'POST', `/api/g/${otra.edicion}/aportes`, {
      objetivoId: otra.objetivoId,
      acreditadoA: otra.miembros.Ana,
      monto: 10_000,
      fechaValor: '2026-09-10',
      registradoPor: 'Ana',
    });

    const intento = await pedir(ctx, 'POST', `/api/g/${casa.edicion}/aportes/${datos.aporte.id}/anular`, {
      motivo: 'Curiosidad',
      anuladoPor: 'Alguien',
    });
    expect(intento.estado).toBe(404);
  });

  it('el mismo despliegue sirve a dos grupos con composición distinta (criterio de éxito 5)', async () => {
    const ctx = montarApi();
    const casa = await grupoDeEjemplo(ctx);
    const { datos: otro } = await pedir(ctx, 'POST', '/api/grupos', { nombre: 'Finca', codigoMoneda: 'USD', exponente: 2 });

    const estadoCasa = await pedir(ctx, 'GET', `/api/g/${casa.edicion}/estado`);
    const estadoFinca = await pedir(ctx, 'GET', `/api/g/${otro.enlaceEdicion}/estado`);
    expect(estadoCasa.datos.estado.moneda).toEqual({ codigo: 'COP', exponente: 0 });
    expect(estadoFinca.datos.estado.moneda).toEqual({ codigo: 'USD', exponente: 2 });
  });
});
