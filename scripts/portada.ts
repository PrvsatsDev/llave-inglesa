/**
 * Captura la imagen de vista previa del enlace (og:image, 1200×630): arranca el servidor de desarrollo,
 * abre /video.html?portada y guarda la captura en apps/web/public/portada.png, que sí entra en el build.
 *
 *   npx tsx scripts/portada.ts
 */
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PUERTO = 4191;
const DESTINO = new URL('../apps/web/public/portada.png', import.meta.url).pathname;

// En su propio grupo de procesos, para poder cerrarlo entero (npx y vite) al terminar.
const servidor = spawn('npx', ['vite', '--port', String(PUERTO), '--strictPort'], {
  cwd: new URL('../apps/web/', import.meta.url).pathname,
  stdio: 'ignore',
  detached: true,
});
try {
  const url = `http://127.0.0.1:${PUERTO}/video.html?portada`;
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  // Esperar al servidor con el propio navegador (la primera vez Vite optimiza las dependencias y tarda).
  for (let i = 0; ; i++) {
    if (await pagina.goto(url).then((r) => r?.ok() ?? false, () => false)) break;
    if (i > 240) throw new Error('El servidor de desarrollo no arranca');
    await new Promise((r) => setTimeout(r, 500));
  }
  await pagina.evaluate(async () => {
    await document.fonts.ready;
  });
  await pagina.waitForSelector('.react-flow__node');
  await pagina.waitForTimeout(500);
  await pagina.screenshot({ path: DESTINO });
  await navegador.close();
  console.log(`Portada guardada en ${DESTINO}`);
} finally {
  process.kill(-servidor.pid!);
}
