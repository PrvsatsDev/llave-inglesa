/**
 * Renderiza el vídeo: arranca el servidor de desarrollo, abre /video.html?render a 1920×1080, captura
 * cada fotograma con Playwright y los junta en un MP4 con ffmpeg. Sin dependencias nuevas.
 * Uso: npx tsx scripts/video.ts    (resultado en video/salida/, que no se sube al repo)
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PUERTO = 4190;
const SALIDA = new URL('../video/salida/', import.meta.url).pathname;
const FOTOGRAMAS = `${SALIDA}fotogramas/`;

rmSync(FOTOGRAMAS, { recursive: true, force: true });
mkdirSync(FOTOGRAMAS, { recursive: true });

// En su propio grupo de procesos, para poder cerrarlo entero (npx y vite) al terminar.
const servidor = spawn('npx', ['vite', '--port', String(PUERTO), '--strictPort'], {
  cwd: new URL('../apps/web/', import.meta.url).pathname,
  stdio: 'ignore',
  detached: true,
});
try {
  const url = `http://127.0.0.1:${PUERTO}/video.html?render`;
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  // Esperar al servidor con el propio navegador (la primera vez Vite optimiza las dependencias y tarda).
  for (let i = 0; ; i++) {
    if (await pagina.goto(url).then((r) => r?.ok() ?? false, () => false)) break;
    if (i > 240) throw new Error('El servidor de desarrollo no arranca');
    await new Promise((r) => setTimeout(r, 500));
  }
  await pagina.evaluate(async () => {
    await document.fonts.ready;
  });
  await pagina.waitForFunction(() => typeof window.__fotograma === 'function');
  // El mapa se encuadra cuando React Flow ha medido los nodos.
  await pagina.waitForSelector('.react-flow__node');
  await pagina.waitForTimeout(500);
  const duracion = await pagina.evaluate(() => window.__duracion!);
  for (let f = 0; f < duracion; f++) {
    await pagina.evaluate((n) => window.__fotograma!(n), f);
    await pagina.screenshot({ path: `${FOTOGRAMAS}${String(f).padStart(4, '0')}.png` });
    if (f % 30 === 0) process.stdout.write(`fotograma ${f}/${duracion}\n`);
  }
  await navegador.close();

  const mp4 = `${SALIDA}llave-inglesa.mp4`;
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', `${FOTOGRAMAS}%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg ha fallado');
  console.log(mp4);
} finally {
  process.kill(-servidor.pid!);
}
