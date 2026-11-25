import { expect, test, type Page } from '@playwright/test';

/**
 * Los tres flujos que sostienen la app. Si estos pasan, la familia puede usarla.
 */

/** Crea un grupo desde cero y devuelve sus dos enlaces (HU-01). */
async function crearGrupo(page: Page, nombre: string) {
  await page.goto('/');
  await page.getByLabel('¿Cómo se llama el grupo?').fill(nombre);
  await page.getByRole('button', { name: 'Crear grupo' }).click();

  const edicion = await page.locator('code').first().innerText();
  const lectura = await page.locator('code').nth(1).innerText();
  return { edicion, lectura };
}

async function identificarse(page: Page, url: string, nombre: string) {
  await page.goto(url);
  await page.getByRole('button', { name: nombre, exact: true }).click();
}

async function agregarMiembro(page: Page, nombre: string) {
  await page.getByRole('button', { name: 'Personas' }).click();
  await page.getByLabel('Agregar a alguien').fill(nombre);
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByRole('heading', { name: nombre, exact: true })).toBeVisible();
}

test.describe('HU-01 — crear un grupo y compartirlo', () => {
  test('se obtienen dos enlaces distintos, con la advertencia de que no se recuperan', async ({ page }) => {
    const { edicion, lectura } = await crearGrupo(page, 'Casa de prueba');

    expect(edicion).not.toBe(lectura);
    expect(edicion).toMatch(/\/g\/[A-Za-z0-9_-]{27}$/);

    // La advertencia tiene que verse sin desplazarse (T-031).
    const advertencia = page.getByText('Copia estos enlaces antes de cerrar');
    await expect(advertencia).toBeInViewport();
  });

  test('con el enlace de solo lectura no aparece ninguna acción de escritura', async ({ page }) => {
    const { edicion, lectura } = await crearGrupo(page, 'Casa de consulta');

    await page.goto(edicion);
    await page.getByRole('button', { name: 'Entrar y agregar personas' }).click();
    await agregarMiembro(page, 'Ana');

    await identificarse(page, lectura, 'Ana');
    await expect(page.getByText('👁 Solo lectura')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Nuevo objetivo' })).toHaveCount(0);
  });

  test('al rotar el enlace, el anterior deja de servir', async ({ page, request }) => {
    const { edicion } = await crearGrupo(page, 'Casa rotada');
    const token = edicion.split('/g/')[1] ?? '';

    const rotacion = await request.post(`/api/g/${token}/rotar-enlace`, { data: { tipo: 'EDICION' } });
    expect(rotacion.ok()).toBe(true);

    await page.goto(edicion);
    await expect(page.getByRole('heading', { name: 'Este enlace ya no sirve' })).toBeVisible();
  });
});

test.describe('HU-05 y HU-06 — registrar un aporte y ver el estado', () => {
  test('el caso de la spec de punta a punta: $100.000 entre tres', async ({ page }) => {
    const { edicion } = await crearGrupo(page, 'Casa de los Rodríguez');

    await page.goto(edicion);
    await page.getByRole('button', { name: 'Entrar y agregar personas' }).click();
    for (const nombre of ['Ana', 'Luis', 'Sara']) await agregarMiembro(page, nombre);

    // HU-06: quien abre el enlace se identifica y ve primero lo suyo.
    await page.getByRole('button', { name: 'No soy yo' }).click();
    await page.getByRole('button', { name: 'Ana', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Lo mío' })).toBeVisible();

    // HU-03: crear el objetivo repartido en partes iguales.
    await page.getByRole('button', { name: 'Objetivos' }).click();
    await page.getByRole('button', { name: '+ Nuevo objetivo' }).click();
    await page.getByLabel('¿Para qué es?').fill('Nevera');
    await page.getByLabel('¿Cuánto cuesta en total?').fill('100000');
    await page.getByRole('button', { name: 'Crear objetivo' }).click();

    // RN-01 y RN-04: 33.334 / 33.333 / 33.333, y la suma es exactamente el total.
    await expect(page.getByText('Debes en total')).toBeVisible();
    await expect(page.getByText('$ 33.334').first()).toBeVisible();

    // HU-05: registrar el aporte propio. Viene prellenado con lo que se debe (RNF-03).
    await page.getByRole('button', { name: 'Registrar aporte' }).click();
    await expect(page.getByLabel('¿Cuánto?')).toHaveValue('33334');
    await page.getByRole('button', { name: 'Guardar aporte' }).click();

    // El saldo baja de inmediato.
    await expect(page.getByText('Estás al día')).toBeVisible();
    // La cifra aparece en el total del grupo y en la tarjeta del objetivo; aquí interesa la
    // de la tarjeta.
    await expect(page.getByRole('article').getByText('$ 33.334 de $ 100.000')).toBeVisible();

    // HU-06 y RF-15: cualquier cifra se desglosa hasta los aportes que la producen.
    await page.getByRole('button', { name: 'Ver detalle' }).click();
    await expect(page.getByRole('cell', { name: 'Ana', exact: true })).toBeVisible();
    await expect(page.getByText('De dónde salen estas cifras')).toBeVisible();
  });

  test('HU-07 — anular deja el aporte visible y devuelve el saldo', async ({ page }) => {
    const { edicion } = await crearGrupo(page, 'Casa con error');

    await page.goto(edicion);
    await page.getByRole('button', { name: 'Entrar y agregar personas' }).click();
    await agregarMiembro(page, 'Ana');

    await page.getByRole('button', { name: 'Objetivos' }).click();
    await page.getByRole('button', { name: '+ Nuevo objetivo' }).click();
    await page.getByLabel('¿Para qué es?').fill('Recibo de la luz');
    await page.getByLabel('¿Cuánto cuesta en total?').fill('80000');
    await page.getByRole('button', { name: 'Crear objetivo' }).click();

    await page.getByRole('button', { name: 'No soy yo' }).click();
    await page.getByRole('button', { name: 'Ana', exact: true }).click();

    await page.getByRole('button', { name: 'Registrar aporte' }).click();
    await page.getByRole('button', { name: 'Guardar aporte' }).click();
    await expect(page.getByText('Estás al día')).toBeVisible();

    await page.getByRole('button', { name: 'Historial' }).click();
    await page.getByRole('button', { name: 'Anular' }).click();
    await page.getByLabel('¿Por qué se anula?').fill('El recibo se pagó por otro lado');
    await page.getByRole('button', { name: 'Anular aporte' }).click();

    // Artículo V: sigue visible, con su motivo, y el saldo vuelve.
    await expect(page.getByText('Anulado: El recibo se pagó por otro lado')).toBeVisible();
    await expect(page.getByText('Debes en total')).toBeVisible();
  });
});
