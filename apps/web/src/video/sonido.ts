/**
 * Efectos de sonido del vídeo, sintetizados con Web Audio sin reproducirlos (OfflineAudioContext):
 * cada escena dice en qué fotograma suena cada efecto, y el render los convierte en un WAV sincronizado.
 * El ruido sale de un generador con semilla fija, así que el audio es determinista, como la imagen.
 */
import { FPS } from './tiempo.ts';

export type TipoSonido = 'whoosh' | 'tic' | 'golpe' | 'fuego' | 'grave' | 'acorde' | 'campana';

/** Un efecto que empieza en un fotograma (de la escena). `dur` en segundos; `notas` en Hz. */
export interface Sonido {
  f: number;
  tipo: TipoSonido;
  dur?: number;
  vol?: number;
  notas?: number[];
}

const MUESTREO = 48000;

/** Generador pseudoaleatorio con semilla (mulberry32): el mismo ruido en cada render. */
function aleatorio(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ruido(ctx: BaseAudioContext, segundos: number, semilla: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.round(segundos * MUESTREO)), MUESTREO);
  const datos = buffer.getChannelData(0);
  const r = aleatorio(semilla);
  for (let i = 0; i < datos.length; i++) datos[i] = r() * 2 - 1;
  return buffer;
}

/** Envolvente: sube en `ataque` hasta `pico` y cae hasta casi nada en `caida` (segundos). */
function envolvente(ctx: BaseAudioContext, t: number, ataque: number, caida: number, pico: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + caida);
  return g;
}

function sintetizar(ctx: BaseAudioContext, salida: AudioNode, s: Sonido, t: number, semilla: number) {
  const vol = s.vol ?? 1;
  switch (s.tipo) {
    case 'whoosh': {
      // Ruido que barre de grave a agudo, de izquierda a derecha.
      const dur = s.dur ?? 0.45;
      const fuente = ctx.createBufferSource();
      fuente.buffer = ruido(ctx, dur, semilla);
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'bandpass';
      filtro.Q.value = 1.2;
      filtro.frequency.setValueAtTime(300, t);
      filtro.frequency.exponentialRampToValueAtTime(3500, t + dur);
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(-0.4, t);
      pan.pan.linearRampToValueAtTime(0.4, t + dur);
      const g = envolvente(ctx, t, dur * 0.45, dur * 0.55, 0.35 * vol);
      fuente.connect(filtro).connect(g).connect(pan).connect(salida);
      fuente.start(t);
      break;
    }
    case 'tic': {
      // Clic corto y agudo, como el de un contador.
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 2200;
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'highpass';
      filtro.frequency.value = 1500;
      const g = envolvente(ctx, t, 0.002, 0.035, 0.14 * vol);
      o.connect(filtro).connect(g).connect(salida);
      o.start(t);
      o.stop(t + 0.05);
      break;
    }
    case 'golpe': {
      // Golpe grave: un seno que cae de tono, con un poco de ruido al principio.
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(32, t + 0.8);
      const g = envolvente(ctx, t, 0.01, 1.1, 0.9 * vol);
      o.connect(g).connect(salida);
      o.start(t);
      o.stop(t + 1.2);
      const fuente = ctx.createBufferSource();
      fuente.buffer = ruido(ctx, 0.3, semilla);
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = 900;
      const gr = envolvente(ctx, t, 0.005, 0.25, 0.4 * vol);
      fuente.connect(filtro).connect(gr).connect(salida);
      fuente.start(t);
      break;
    }
    case 'fuego': {
      // Fuego: un rumor grave continuo y chasquidos sueltos, repartidos por los dos canales.
      const dur = s.dur ?? 4;
      const fuente = ctx.createBufferSource();
      fuente.buffer = ruido(ctx, dur, semilla);
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = 500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.25 * vol, t + 0.8);
      g.gain.setValueAtTime(0.25 * vol, t + dur - 1);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      fuente.connect(filtro).connect(g).connect(salida);
      fuente.start(t);
      const r = aleatorio(semilla + 1);
      for (let k = 0; k < dur * 22; k++) {
        const tc = t + 0.4 + r() * (dur - 0.8);
        const chasquido = ctx.createBufferSource();
        chasquido.buffer = ruido(ctx, 0.02, semilla + 2 + k);
        const fc = ctx.createBiquadFilter();
        fc.type = 'bandpass';
        fc.frequency.value = 1200 + r() * 3000;
        const pan = ctx.createStereoPanner();
        pan.pan.value = r() * 1.6 - 0.8;
        const gc = envolvente(ctx, tc, 0.001, 0.015 + r() * 0.03, (0.05 + r() * 0.12) * vol);
        chasquido.connect(fc).connect(gc).connect(pan).connect(salida);
        chasquido.start(tc);
      }
      break;
    }
    case 'grave':
    case 'acorde':
    case 'campana': {
      // Notas sostenidas: grave (un aviso serio), acorde (cálido) o campana (brillante, que se apaga).
      const notas = s.notas ?? (s.tipo === 'grave' ? [73.4, 110] : s.tipo === 'acorde' ? [261.6, 329.6, 392] : [880, 1318.5]);
      const dur = s.dur ?? (s.tipo === 'campana' ? 1.6 : 1.8);
      notas.forEach((hz, i) => {
        const o = ctx.createOscillator();
        o.type = s.tipo === 'campana' ? 'sine' : 'triangle';
        o.frequency.value = hz;
        const pico = (s.tipo === 'grave' ? 0.35 : s.tipo === 'acorde' ? 0.12 : 0.1) * vol;
        const g = envolvente(ctx, t + i * 0.02, s.tipo === 'campana' ? 0.005 : 0.08, dur, pico);
        o.connect(g).connect(salida);
        o.start(t);
        o.stop(t + dur + 0.2);
      });
      break;
    }
  }
}

/** Renderiza los sonidos (con su fotograma en el vídeo completo) en un tramo de `fotogramas` desde `desde`. */
export async function renderizarAudio(sonidos: readonly { f: number; sonido: Sonido }[], desde: number, fotogramas: number): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil((fotogramas / FPS) * MUESTREO), MUESTREO);
  // Un compresor suave evita que se saturen los sonidos que coinciden.
  // Volumen general con margen, y un compresor suave para que los sonidos que coinciden no saturen.
  const compresor = ctx.createDynamicsCompressor();
  compresor.threshold.value = -18;
  compresor.ratio.value = 4;
  const general = ctx.createGain();
  general.gain.value = 0.6;
  compresor.connect(general).connect(ctx.destination);
  sonidos
    .filter(({ f }) => f >= desde && f < desde + fotogramas)
    .forEach(({ f, sonido }, i) => sintetizar(ctx, compresor, sonido, (f - desde) / FPS, 1000 + i * 97));
  return ctx.startRendering();
}

/** WAV de 16 bits a partir del audio renderizado, en base64 (para pasárselo al script de render). */
export function wavBase64(buffer: AudioBuffer): string {
  const canales = buffer.numberOfChannels;
  const muestras = buffer.length;
  const datos = new DataView(new ArrayBuffer(44 + muestras * canales * 2));
  const texto = (o: number, s: string) => [...s].forEach((c, i) => datos.setUint8(o + i, c.charCodeAt(0)));
  texto(0, 'RIFF');
  datos.setUint32(4, 36 + muestras * canales * 2, true);
  texto(8, 'WAVEfmt ');
  datos.setUint32(16, 16, true);
  datos.setUint16(20, 1, true);
  datos.setUint16(22, canales, true);
  datos.setUint32(24, buffer.sampleRate, true);
  datos.setUint32(28, buffer.sampleRate * canales * 2, true);
  datos.setUint16(32, canales * 2, true);
  datos.setUint16(34, 16, true);
  texto(36, 'data');
  datos.setUint32(40, muestras * canales * 2, true);
  const canal = [...Array(canales).keys()].map((c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < muestras; i++) {
    for (let c = 0; c < canales; c++) {
      const v = Math.max(-1, Math.min(1, canal[c]![i]!));
      datos.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  const bytes = new Uint8Array(datos.buffer);
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}
