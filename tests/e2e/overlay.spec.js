const { test, expect } = require('@playwright/test');

// Overlay para OBS (ruta /). Requiere la web Next.js levantada.
test.describe('Overlay OBS', () => {
  test('carga la página principal', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
  });

  test('se conecta al stream de eventos /api/overload', async ({ page }) => {
    const sse = page.waitForResponse(
      (res) => res.url().includes('/api/overload') && res.status() === 200
    );
    await page.goto('/');
    const response = await sse;
    expect(response.headers()['content-type']).toContain('text/event-stream');
  });
});
