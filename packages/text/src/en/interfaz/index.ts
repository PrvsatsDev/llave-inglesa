import type { UI as es } from '../../es/interfaz/index.ts';
import { analisis } from './analisis.ts';
import { archivo, cabecera } from './cabecera.ts';
import { comun } from './comun.ts';
import { dialogos } from './dialogos.ts';
import { esquema, nuevos } from './esquema.ts';
import { backup, campos, cartera, descriptor, dispositivo, hardware, key, persona, ubicacion } from './fichas.ts';
import { ficheros } from './ficheros.ts';
import { hallazgos } from './hallazgos.ts';
import { hojaCarta, hojaDescriptor } from './hojas.ts';
import { mapa } from './mapa.ts';
import { marco } from './marco.ts';
import { banner, navegacion } from './navegacion.ts';
import { puntuaciones } from './puntuaciones.ts';
import { simular } from './simular.ts';

/** The web interface texts, by zone: the same shape as the Spanish ones. */
export const UI: typeof es = { comun, cabecera, archivo, ficheros, dialogos, marco, navegacion, banner, esquema, puntuaciones, analisis, hallazgos, nuevos, simular, campos, persona, backup, cartera, hardware, dispositivo, key, ubicacion, mapa, descriptor, hojaDescriptor, hojaCarta };
