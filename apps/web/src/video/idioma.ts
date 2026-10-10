import { IDIOMAS, setIdioma, type Idioma } from '../lib/text.ts';

// El vídeo sale en español salvo con ?idioma=en (scripts/video.ts --idioma en). Se importa antes que nada:
// las escenas calculan sus textos al cargarse.
const pedido = new URLSearchParams(location.search).get('idioma');
const elegido: Idioma = pedido && (IDIOMAS as string[]).includes(pedido) ? (pedido as Idioma) : 'es';
setIdioma(elegido);
document.documentElement.lang = elegido;
