import { analisis } from './analisis.ts';
import { archivo, cabecera } from './cabecera.ts';
import { comun } from './comun.ts';
import { dialogos } from './dialogos.ts';
import { esquema } from './esquema.ts';
import { backup, campos, cartera, descriptor, dispositivo, hardware, key, persona, ubicacion } from './fichas.ts';
import { ficheros } from './ficheros.ts';
import { hallazgos } from './hallazgos.ts';
import { hojaCarta, hojaDescriptor } from './hojas.ts';
import { mapa } from './mapa.ts';
import { marco } from './marco.ts';
import { banner, navegacion } from './navegacion.ts';
import { puntuaciones } from './puntuaciones.ts';
import { simular } from './simular.ts';

/**
 * Textos de la interfaz web, por zonas. Las cadenas fijas son cadenas; las que llevan datos, funciones.
 * Una traducción será otro objeto con la misma forma (`TextosInterfaz`).
 */
export const UI = { comun, cabecera, archivo, ficheros, dialogos, marco, navegacion, banner, esquema, puntuaciones, analisis, hallazgos, simular, campos, persona, backup, cartera, hardware, dispositivo, key, ubicacion, mapa, descriptor, hojaDescriptor, hojaCarta };

export type TextosInterfaz = typeof UI;
