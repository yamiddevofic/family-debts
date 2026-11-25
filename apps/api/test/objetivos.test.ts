import { describe, expect, it } from 'vitest';
import { grupoDeEjemplo, montarApi, pedir } from './ayudas.ts';

const codigos = (datos: any): string[] => datos.error.problemas.map((p: { codigo: string }) => p.codigo);

describe('RF-05 — crear un objetivo de monto total repartido', () => {
  it('HU-03 — cada involucrado queda con su obligación y la suma es el total (INV-02)', async () => {
    const ctx = montarApi();
    const { edicion } = await grupoDeEjemplo(ctx);
    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const objetivo = datos.estado.objetivos[0];
    expect(objetivo.involucrados.map((i: { obligacion: number }) => i.obligacion)).toEqual([
      33_334, 33_333, 33_333,
    ]);
    expect(objetivo.involucrados.reduce((t: number, i: { obligacion: number }) => t + i.obligacion, 0)).toBe(
      100_000,
    );
  });

  it('CB-11 — un grupo sin miembros no puede crear objetivos', async () => {
    const ctx = montarApi();
    const { datos: creado } = await pedir(ctx, 'POST', '/api/grupos', { nombre: 'Casa' });
    const intento = await pedir(ctx, 'POST', `/api/g/${creado.enlaceEdicion}/objetivos`, {
      nombre: 'Nevera',
      montoTotal: 100_000,
      involucrados: [],
    });
    expect(intento.estado).toBe(422);
    expect(codigos(intento.datos)).toContain('GRUPO_SIN_MIEMBROS');
  });

  it('un reparto inválido responde 422 diciendo qué está mal (RF-07)', async () => {
    const ctx = montarApi();
    const { edicion, miembros } = await grupoDeEjemplo(ctx);
    const intento = await pedir(ctx, 'POST', `/api/g/${edicion}/objetivos`, {
      nombre: '',
      montoTotal: 0,
      involucrados: [miembros.Ana],
    });
    expect(intento.estado).toBe(422);
    expect(codigos(intento.datos).sort()).toEqual(['MONTO_INVALIDO', 'NOMBRE_VACIO']);
  });

  it('no se puede involucrar a alguien de otro grupo', async () => {
    const ctx = montarApi();
    const casa = await grupoDeEjemplo(ctx);
    const otra = await grupoDeEjemplo(ctx);
    const intento = await pedir(ctx, 'POST', `/api/g/${casa.edicion}/objetivos`, {
      nombre: 'Techo',
      montoTotal: 60_000,
      involucrados: [otra.miembros.Ana],
    });
    expect(intento.estado).toBe(422);
    expect(codigos(intento.datos)).toContain('MIEMBRO_DESCONOCIDO');
  });

  it('Artículo IV — el esquema no guarda saldos, obligaciones ni "pagado" (T-020)', () => {
    const ctx = montarApi();
    const tablas = ctx.base
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    expect(tablas.map((t) => t.name).sort()).toEqual(['aporte', 'grupo', 'involucrado', 'miembro', 'objetivo']);

    for (const tabla of tablas) {
      const columnas = (ctx.base.prepare(`PRAGMA table_info(${tabla.name})`).all() as { name: string }[]).map(
        (c) => c.name,
      );
      for (const prohibida of ['saldo', 'obligacion', 'pagado', 'aportado', 'faltante', 'saldado', 'en_mora']) {
        expect(columnas).not.toContain(prohibida);
      }
    }
  });
});

describe('RF-06 — crear un objetivo de cuotas mensuales', () => {
  it('HU-04 — se generan los periodos y cada involucrado ve su cuota (RN-05, RN-06)', async () => {
    const ctx = montarApi();
    const { edicion, miembros } = await grupoDeEjemplo(ctx);
    const creado = await pedir(ctx, 'POST', `/api/g/${edicion}/objetivos`, {
      nombre: 'Techo',
      montoTotal: 900_000,
      modalidad: 'CUOTAS_PERIODICAS',
      periodicidad: 'MENSUAL',
      fechaInicio: '2026-09-05',
      fechaLimite: '2026-12-05',
      involucrados: [miembros.Ana, miembros.Luis, miembros.Sara],
    });
    expect(creado.estado).toBe(201);

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const techo = datos.estado.objetivos.find((o: { nombre: string }) => o.nombre === 'Techo');
    expect(techo.periodos.map((p: { fechaVencimiento: string }) => p.fechaVencimiento)).toEqual([
      '2026-09-05',
      '2026-10-05',
      '2026-11-05',
      '2026-12-05',
    ]);
    expect(techo.involucrados[0].periodos.map((p: { cuota: number }) => p.cuota)).toEqual([
      75_000, 75_000, 75_000, 75_000,
    ]);
  });

  it('HU-04 — una fecha límite anterior a la de inicio se rechaza', async () => {
    const ctx = montarApi();
    const { edicion, miembros } = await grupoDeEjemplo(ctx);
    const intento = await pedir(ctx, 'POST', `/api/g/${edicion}/objetivos`, {
      nombre: 'Techo',
      montoTotal: 900_000,
      modalidad: 'CUOTAS_PERIODICAS',
      periodicidad: 'MENSUAL',
      fechaInicio: '2026-12-05',
      fechaLimite: '2026-09-05',
      involucrados: [miembros.Ana],
    });
    expect(intento.estado).toBe(422);
    expect(codigos(intento.datos)).toContain('LIMITE_ANTERIOR_A_INICIO');
  });

  it('los periodos vencidos e impagos aparecen en mora a la fecha de consulta (RN-12)', async () => {
    const ctx = montarApi();
    const { edicion, miembros } = await grupoDeEjemplo(ctx);
    await pedir(ctx, 'POST', `/api/g/${edicion}/objetivos`, {
      nombre: 'Techo',
      montoTotal: 900_000,
      modalidad: 'CUOTAS_PERIODICAS',
      periodicidad: 'MENSUAL',
      fechaInicio: '2026-09-05',
      fechaLimite: '2026-12-05',
      involucrados: [miembros.Ana, miembros.Luis, miembros.Sara],
    });

    ctx.reloj.fijarHoy('2026-09-01');
    const antes = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    expect(antes.datos.estado.objetivos.some((o: { enMora: boolean }) => o.enMora)).toBe(false);

    ctx.reloj.fijarHoy('2026-11-10');
    const despues = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const techo = despues.datos.estado.objetivos.find((o: { nombre: string }) => o.nombre === 'Techo');
    expect(techo.enMora).toBe(true);
    expect(techo.involucrados[0].periodos.filter((p: { enMora: boolean }) => p.enMora)).toHaveLength(3);
  });
});
