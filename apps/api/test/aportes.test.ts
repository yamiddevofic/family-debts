import { describe, expect, it } from 'vitest';
import { grupoDeEjemplo, montarApi, pedir, type Contexto } from './ayudas.ts';

async function registrar(ctx: Contexto, enlace: string, cuerpo: Record<string, unknown>) {
  return pedir(ctx, 'POST', `/api/g/${enlace}/aportes`, {
    fechaValor: '2026-09-10',
    registradoPor: 'Ana',
    ...cuerpo,
  });
}

const objetivoDe = (datos: any, nombre = 'Nevera') =>
  datos.estado.objetivos.find((o: { nombre: string }) => o.nombre === nombre);

describe('RF-09 — registrar un aporte', () => {
  it('HU-05 — el saldo de esa persona baja de inmediato y el aporte queda en el historial', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    const creado = await registrar(ctx, edicion, { objetivoId, acreditadoA: miembros.Ana, monto: 20_000 });
    expect(creado.estado).toBe(201);

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const ana = objetivoDe(datos).involucrados.find((i: { miembroId: string }) => i.miembroId === miembros.Ana);
    expect(ana.aportado).toBe(20_000);
    expect(ana.debe).toBe(13_334);
    expect(objetivoDe(datos).aportes).toHaveLength(1);
  });

  it('CB-04 — un aporte de monto cero o negativo responde 422', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    expect((await registrar(ctx, edicion, { objetivoId, acreditadoA: miembros.Ana, monto: 0 })).estado).toBe(422);
    expect((await registrar(ctx, edicion, { objetivoId, acreditadoA: miembros.Ana, monto: -5_000 })).estado).toBe(
      422,
    );
  });

  it('CB-05 — un aporte con fecha anterior al objetivo se acepta: registrar es retroactivo', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    const creado = await registrar(ctx, edicion, {
      objetivoId,
      acreditadoA: miembros.Ana,
      monto: 10_000,
      fechaValor: '2020-01-15',
    });
    expect(creado.estado).toBe(201);
  });

  it('CB-06 — un aporte con fecha futura se acepta y se marca como futuro', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    await registrar(ctx, edicion, {
      objetivoId,
      acreditadoA: miembros.Ana,
      monto: 10_000,
      fechaValor: '2027-01-15',
    });
    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    expect(objetivoDe(datos).aportes[0].futuro).toBe(true);
  });

  it('INV-06 — no se puede acreditar a alguien que no está involucrado en el objetivo', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    const { datos: nuevo } = await pedir(ctx, 'POST', `/api/g/${edicion}/miembros`, { nombre: 'Papá' });
    const intento = await registrar(ctx, edicion, {
      objetivoId,
      acreditadoA: nuevo.miembro.id,
      monto: 10_000,
    });
    expect(intento.estado).toBe(422);
    expect(intento.datos.error.problemas[0].codigo).toBe('ACREDITADO_NO_INVOLUCRADO');
    expect(miembros.Ana).toBeDefined();
  });

  it('RN-17 — exige decir quién registra, aunque no sea autenticación', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    const intento = await registrar(ctx, edicion, {
      objetivoId,
      acreditadoA: miembros.Ana,
      monto: 10_000,
      registradoPor: '',
    });
    expect(intento.estado).toBe(422);
  });
});

describe('RN-15 — pago por cuenta de otro', () => {
  it('HU-05 — baja el saldo de quien se acredita, no el del pagador', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    const { datos: papa } = await pedir(ctx, 'POST', `/api/g/${edicion}/miembros`, { nombre: 'Papá' });

    await registrar(ctx, edicion, {
      objetivoId,
      acreditadoA: miembros.Sara,
      pagadoPor: papa.miembro.id,
      monto: 33_333,
    });

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const porMiembro = (id: string) => datos.estado.porMiembro.find((m: { miembroId: string }) => m.miembroId === id);
    expect(porMiembro(miembros.Sara).debeTotal).toBe(0);
    expect(porMiembro(papa.miembro.id).debeTotal).toBe(0);
    expect(porMiembro(papa.miembro.id).objetivos).toEqual([]);
    expect(objetivoDe(datos).aportes[0].porCuentaDeOtro).toBe(true);
  });

  it('quien paga debe ser miembro del grupo, aunque no esté involucrado', async () => {
    const ctx = montarApi();
    const casa = await grupoDeEjemplo(ctx);
    const otra = await grupoDeEjemplo(ctx);
    const intento = await registrar(ctx, casa.edicion, {
      objetivoId: casa.objetivoId,
      acreditadoA: casa.miembros.Ana,
      pagadoPor: otra.miembros.Ana,
      monto: 10_000,
    });
    expect(intento.estado).toBe(422);
    expect(intento.datos.error.problemas[0].codigo).toBe('PAGADOR_NO_ES_MIEMBRO');
  });
});

describe('RN-08 — imputación de un aporte a los periodos', () => {
  async function conCuotas(ctx: Contexto) {
    const base = await grupoDeEjemplo(ctx);
    const { datos } = await pedir(ctx, 'POST', `/api/g/${base.edicion}/objetivos`, {
      nombre: 'Techo',
      montoTotal: 300_000,
      modalidad: 'CUOTAS_PERIODICAS',
      periodicidad: 'MENSUAL',
      fechaInicio: '2026-09-05',
      fechaLimite: '2026-11-05',
      involucrados: [base.miembros.Ana, base.miembros.Luis, base.miembros.Sara],
    });
    return { ...base, techoId: datos.objetivo.id as string };
  }

  it('HU-05 — sin indicar periodo se imputa al más antiguo y el excedente cae en cascada', async () => {
    const ctx = montarApi();
    const { edicion, miembros, techoId } = await conCuotas(ctx);
    // Cuota de Ana: 100.000 ÷ 3 periodos = 33.334 / 33.333 / 33.333.
    await registrar(ctx, edicion, { objetivoId: techoId, acreditadoA: miembros.Ana, monto: 50_000 });

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const ana = objetivoDe(datos, 'Techo').involucrados.find(
      (i: { miembroId: string }) => i.miembroId === miembros.Ana,
    );
    expect(ana.periodos.map((p: { aplicado: number }) => p.aplicado)).toEqual([33_334, 16_666, 0]);
    expect(ana.periodos.map((p: { pendiente: number }) => p.pendiente)).toEqual([0, 16_667, 33_333]);
  });

  it('indicando periodo se imputa allí, aunque genere excedente en ese periodo', async () => {
    const ctx = montarApi();
    const { edicion, miembros, techoId } = await conCuotas(ctx);
    await registrar(ctx, edicion, {
      objetivoId: techoId,
      acreditadoA: miembros.Ana,
      monto: 50_000,
      periodoIndice: 1,
    });

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const ana = objetivoDe(datos, 'Techo').involucrados.find(
      (i: { miembroId: string }) => i.miembroId === miembros.Ana,
    );
    expect(ana.periodos[1].aplicado).toBe(50_000);
    expect(ana.periodos[1].aFavor).toBe(16_667);
    expect(ana.periodos[0].pendiente).toBe(33_334);
  });

  it('un periodo fuera del calendario se rechaza', async () => {
    const ctx = montarApi();
    const { edicion, miembros, techoId } = await conCuotas(ctx);
    const intento = await registrar(ctx, edicion, {
      objetivoId: techoId,
      acreditadoA: miembros.Ana,
      monto: 10_000,
      periodoIndice: 9,
    });
    expect(intento.estado).toBe(422);
    expect(intento.datos.error.problemas[0].codigo).toBe('PERIODO_FUERA_DE_RANGO');
  });

  it('la imputación es derivada: al anular un aporte, los periodos se recalculan solos', async () => {
    const ctx = montarApi();
    const { edicion, miembros, techoId } = await conCuotas(ctx);
    const { datos: creado } = await registrar(ctx, edicion, {
      objetivoId: techoId,
      acreditadoA: miembros.Ana,
      monto: 50_000,
    });

    await pedir(ctx, 'POST', `/api/g/${edicion}/aportes/${creado.aporte.id}/anular`, {
      motivo: 'No se hizo la transferencia',
      anuladoPor: 'Ana',
    });

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const ana = objetivoDe(datos, 'Techo').involucrados.find(
      (i: { miembroId: string }) => i.miembroId === miembros.Ana,
    );
    expect(ana.periodos.map((p: { pendiente: number }) => p.pendiente)).toEqual([33_334, 33_333, 33_333]);
  });
});

describe('RN-09 — excedente y saldo a favor', () => {
  it('HU-05 — un aporte mayor a lo debido se acepta y aparece como saldo a favor', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    const creado = await registrar(ctx, edicion, { objetivoId, acreditadoA: miembros.Ana, monto: 50_000 });
    expect(creado.estado).toBe(201);

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const ana = objetivoDe(datos).involucrados.find((i: { miembroId: string }) => i.miembroId === miembros.Ana);
    expect(ana.aFavor).toBe(16_666);
    expect(ana.debe).toBe(0);
  });
});

describe('RN-13 — anulación de aportes', () => {
  it('HU-07 — anular exige motivo y deja el aporte visible, no lo borra', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    const { datos: creado } = await registrar(ctx, edicion, {
      objetivoId,
      acreditadoA: miembros.Ana,
      monto: 90_000,
    });

    const sinMotivo = await pedir(ctx, 'POST', `/api/g/${edicion}/aportes/${creado.aporte.id}/anular`, {
      anuladoPor: 'Ana',
    });
    expect(sinMotivo.estado).toBe(422);
    expect(sinMotivo.datos.error.problemas[0].codigo).toBe('MOTIVO_OBLIGATORIO');

    const anulado = await pedir(ctx, 'POST', `/api/g/${edicion}/aportes/${creado.aporte.id}/anular`, {
      motivo: 'Era el monto de otro objetivo',
      anuladoPor: 'Ana',
    });
    expect(anulado.estado).toBe(200);

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const objetivo = objetivoDe(datos);
    expect(objetivo.recaudado).toBe(0);
    expect(objetivo.aportes).toHaveLength(1);
    expect(objetivo.aportes[0].anulado).toBe(true);
    expect(objetivo.aportes[0].motivoAnulacion).toBe('Era el monto de otro objetivo');
  });

  it('Artículo V — la fila sigue en la base con su historia, no se borra ninguna', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    const { datos: creado } = await registrar(ctx, edicion, {
      objetivoId,
      acreditadoA: miembros.Ana,
      monto: 90_000,
    });
    await pedir(ctx, 'POST', `/api/g/${edicion}/aportes/${creado.aporte.id}/anular`, {
      motivo: 'Monto equivocado',
      anuladoPor: 'Ana',
    });

    const fila = ctx.base.prepare('SELECT * FROM aporte WHERE id = ?').get(creado.aporte.id) as Record<
      string,
      unknown
    >;
    expect(fila.monto).toBe(90_000);
    expect(fila.anulado_por).toBe('Ana');
    expect(fila.anulacion_motivo).toBe('Monto equivocado');
  });

  it('HU-07 — un aporte anulado no se puede volver a anular ni reactivar', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    const { datos: creado } = await registrar(ctx, edicion, {
      objetivoId,
      acreditadoA: miembros.Ana,
      monto: 90_000,
    });
    const anular = () =>
      pedir(ctx, 'POST', `/api/g/${edicion}/aportes/${creado.aporte.id}/anular`, {
        motivo: 'Monto equivocado',
        anuladoPor: 'Ana',
      });
    await anular();
    const segunda = await anular();
    expect(segunda.estado).toBe(409);
    expect(segunda.datos.error.codigo).toBe('APORTE_YA_ANULADO');
  });

  it('CB-10 — anulados todos los aportes, el objetivo vuelve a recaudado 0 y no está saldado', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    const ids: string[] = [];
    for (const [nombre, monto] of [['Ana', 33_334], ['Luis', 33_333], ['Sara', 33_333]] as const) {
      const { datos } = await registrar(ctx, edicion, {
        objetivoId,
        acreditadoA: miembros[nombre],
        monto,
      });
      ids.push(datos.aporte.id);
    }

    const saldado = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    expect(objetivoDe(saldado.datos).saldado).toBe(true);

    for (const id of ids) {
      await pedir(ctx, 'POST', `/api/g/${edicion}/aportes/${id}/anular`, {
        motivo: 'El pago se revirtió',
        anuladoPor: 'Ana',
      });
    }

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    expect(objetivoDe(datos).recaudado).toBe(0);
    expect(objetivoDe(datos).saldado).toBe(false);
  });

  it('con el enlace de lectura no se puede anular', async () => {
    const ctx = montarApi();
    const { edicion, lectura, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    const { datos: creado } = await registrar(ctx, edicion, {
      objetivoId,
      acreditadoA: miembros.Ana,
      monto: 10_000,
    });
    const intento = await pedir(ctx, 'POST', `/api/g/${lectura}/aportes/${creado.aporte.id}/anular`, {
      motivo: 'x',
      anuladoPor: 'y',
    });
    expect(intento.estado).toBe(403);
  });
});

describe('RNF-04 — rendimiento del estado completo', () => {
  /**
   * RNF-04 pide que el estado **se calcule** en menos de 100 ms, y eso se verifica sobre el
   * núcleo en `packages/core/test/estado.test.ts`, donde tarda unos 27 ms.
   *
   * Aquí se mide algo distinto y más caro: el viaje completo por HTTP, que además lee 2.100
   * filas de SQLite (~46 ms) y serializa 1,4 MB de JSON (~24 ms). Eso no es lo que exige
   * RNF-04, pero conviene tenerlo vigilado, así que lleva su propio presupuesto —medido, no
   * inventado— y se toma la mediana de varias pasadas: una sola medición en frío mide sobre
   * todo el estado del recolector de basura.
   *
   * Si este número se acerca al techo, la salida no es subirlo: es sacar el historial
   * completo de `/estado` a su propio endpoint, que el tablero de HU-06 no lo necesita.
   */
  const PRESUPUESTO_DEL_ENDPOINT_MS = 250;

  it('T-028 — 20 miembros, 100 objetivos y 2.000 aportes se resuelven dentro del presupuesto', async () => {
    const ctx = montarApi();
    const { datos: creado } = await pedir(ctx, 'POST', '/api/grupos', { nombre: 'Casa grande' });
    const enlace: string = creado.enlaceEdicion;

    const miembros: string[] = [];
    for (let i = 0; i < 20; i += 1) {
      const { datos } = await pedir(ctx, 'POST', `/api/g/${enlace}/miembros`, { nombre: `Miembro ${String(i)}` });
      miembros.push(datos.miembro.id);
    }

    const objetivos: string[] = [];
    for (let i = 0; i < 100; i += 1) {
      const cuotas = i % 3 === 0;
      const { datos } = await pedir(ctx, 'POST', `/api/g/${enlace}/objetivos`, {
        nombre: `Objetivo ${String(i)}`,
        montoTotal: 1_000_000 + i,
        modalidad: cuotas ? 'CUOTAS_PERIODICAS' : 'REPARTO_UNICO',
        ...(cuotas
          ? { periodicidad: 'MENSUAL', fechaInicio: '2026-01-31', fechaLimite: '2026-12-31' }
          : {}),
        involucrados: miembros.slice(0, 5 + (i % 15)),
      });
      objetivos.push(datos.objetivo.id);
    }

    for (let i = 0; i < 2_000; i += 1) {
      await registrar(ctx, enlace, {
        objetivoId: objetivos[i % 100],
        acreditadoA: miembros[i % 5],
        monto: 10_000 + i,
      });
    }

    const tiempos: number[] = [];
    let ultima;
    for (let i = 0; i < 5; i += 1) {
      const inicio = performance.now();
      ultima = await pedir(ctx, 'GET', `/api/g/${enlace}/estado`);
      tiempos.push(performance.now() - inicio);
    }
    tiempos.sort((a, b) => a - b);
    const mediana = tiempos[2] as number;

    expect(ultima?.estado).toBe(200);
    expect(ultima?.datos.estado.objetivos).toHaveLength(100);
    expect(mediana).toBeLessThan(PRESUPUESTO_DEL_ENDPOINT_MS);
  }, 120_000);
});
