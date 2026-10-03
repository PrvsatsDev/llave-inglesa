/**
 * Renderiza el vídeo: arranca el servidor de desarrollo, abre /video.html?render a 1920×1080, captura
 * cada fotograma con Playwright, sintetiza los efectos de sonido en el propio navegador (Web Audio) y
 * lo junta todo en un MP4 con ffmpeg. Sin dependencias nuevas. El resultado va a video/salida/ (no se sube).
 *
 *   npx tsx scripts/video.ts                       el vídeo completo
 *   npx tsx scripts/video.ts --escena 3            solo una escena (para probar)
 *   npx tsx scripts/video.ts --musica pista.mp3    con música de fondo (baja, con fundidos)
 *   … --musica pista.mp3 --musica-desde 35         empezando la pista en su segundo 35
 *
 * La música va a volumen fijo: los efectos se suman encima sin hacerla bajar ni subir.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const PUERTO = 4190;
const SALIDA = new URL('../video/salida/', import.meta.url).pathname;
const FOTOGRAMAS = `${SALIDA}fotogramas/`;

const argumento = (nombre: string) => {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const escena = argumento('--escena');
const musica = argumento('--musica');
const musicaDesde = Number(argumento('--musica-desde') ?? 0);
const nombre = escena ? `escena-${escena}` : 'llave-inglesa';

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

  const { desde, fotogramas } = escena
    ? await pagina.evaluate((id) => window.__tramo!(id), `escena-${escena}`)
    : { desde: 0, fotogramas: await pagina.evaluate(() => window.__duracion!) };
  for (let k = 0; k < fotogramas; k++) {
    await pagina.evaluate((n) => window.__fotograma!(n), desde + k);
    await pagina.screenshot({ path: `${FOTOGRAMAS}${String(k).padStart(4, '0')}.png` });
    if (k % 30 === 0) process.stdout.write(`fotograma ${k}/${fotogramas}\n`);
  }
  const audio = `${SALIDA}${nombre}.wav`;
  writeFileSync(audio, Buffer.from(await pagina.evaluate(([d, n]) => window.__audio!(d!, n!), [desde, fotogramas]), 'base64'));
  await navegador.close();

  // Imagen + efectos (+ música de fondo, baja y con fundidos, si se indica).
  const segundos = fotogramas / 30;
  const mp4 = `${SALIDA}${nombre}.mp4`;
  const entradas = ['-framerate', '30', '-i', `${FOTOGRAMAS}%04d.png`, '-i', audio];
  // Fundido de entrada marcado (2,5 s) y de salida más suave (1,5 s).
  const mezcla = musica
    ? [
        '-ss',
        String(musicaDesde),
        '-i',
        resolve(musica),
        '-filter_complex',
        `[2:a]volume=0.22,afade=t=in:d=2.5,afade=t=out:st=${Math.max(0, segundos - 1.5)}:d=1.5[m];[1:a][m]amix=inputs=2:duration=first:normalize=0[a]`,
        '-map',
        '0:v',
        '-map',
        '[a]',
      ]
    : ['-map', '0:v', '-map', '1:a'];
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', ...entradas, ...mezcla, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-shortest', mp4],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) throw new Error('ffmpeg ha fallado');
  console.log(mp4);
} finally {
  process.kill(-servidor.pid!);
}
