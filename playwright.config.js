// @ts-check
const { defineConfig } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Las pruebas de lógica usan el almacenamiento en ficheros de @stream-toolkit/common.
// Apuntamos DATA_PATH a un directorio temporal y forzamos NODE_ENV=test
// (esto evita que centerOverload arranque su setInterval al importarse).
process.env.NODE_ENV = 'test';
process.env.DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '.test-data');
fs.mkdirSync(process.env.DATA_PATH, { recursive: true });

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  // El almacenamiento de @stream-toolkit/common es en ficheros compartidos (DATA_PATH),
  // así que ejecutamos en serie para evitar carreras entre ficheros de test.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  projects: [
    {
      // Cobertura de toda la lógica de negocio (bot + @stream-toolkit/common).
      // No necesita navegador: corre en Node puro.
      name: 'logic',
      testDir: './tests/logic',
    },
    {
      // Cobertura end-to-end de la web (overlay OBS + panel admin + API).
      // Necesita navegador instalado (`npx playwright install chromium`)
      // y arranca el servidor Next.js definido en webServer.
      name: 'e2e',
      testDir: './tests/e2e',
      use: {
        baseURL: 'http://localhost:3000',
      },
      // Descomenta para levantar la web automáticamente al lanzar el e2e.
      // Requiere DATA_PATH accesible (en local lo configura `npm run setup`).
      // webServer: {
      //   command: 'npm --workspace apps/web run dev',
      //   url: 'http://localhost:3000',
      //   reuseExistingServer: true,
      //   timeout: 120 * 1000,
      // },
    },
  ],
});
