const { test, expect } = require('@playwright/test');

// Panel de control del streamer (ruta /admin). Requiere la web levantada.
test.describe('Panel admin', () => {
  test('muestra los controles de la cola', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Limpiar' })).toBeVisible();
  });

  test('"Limpiar" pide confirmación antes de actuar', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Limpiar' }).click();
    await expect(page.getByText('¿Estás seguro?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  });

  test('"Siguiente" llama al endpoint de pop', async ({ page }) => {
    await page.goto('/admin');
    const popCall = page.waitForRequest(
      (req) => req.url().includes('/api/admin/queue/pop')
    );
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await popCall;
  });
});

// Pruebas a nivel de API (sin navegador): validan las rutas del backend.
test.describe('API admin', () => {
  test('DELETE /api/admin/queue responde OK', async ({ request }) => {
    const res = await request.delete('/api/admin/queue');
    expect(res.ok()).toBeTruthy();
  });

  test('GET /api/admin/queue/pop con cola vacía responde 404', async ({ request }) => {
    await request.delete('/api/admin/queue'); // asegura cola vacía
    const res = await request.get('/api/admin/queue/pop');
    expect(res.status()).toBe(404);
  });
});
