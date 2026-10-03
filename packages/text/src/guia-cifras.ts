import type { Metrica } from './guia.ts';

/** Generado por scripts/guia.ts con el motor: puntuaciones de cada ejemplo que cita la guía. No editar a mano. */
export const CIFRAS: Record<string, Record<Metrica, number>> = {
  'distribuido-2de3': { security: 65, resilience: 65, usability: 75, inheritance: 76 },
  'r01-papel-en-casa': { security: 35, resilience: 41, usability: 100, inheritance: 70 },
  'r02-foto-en-la-nube': { security: 23, resilience: 41, usability: 100, inheritance: 0 },
  'r03-acero-en-caja-fuerte': { security: 49, resilience: 61, usability: 100, inheritance: 76 },
  'r04-acero-y-banco': { security: 49, resilience: 77, usability: 100, inheritance: 82 },
  'r05-passphrase-copia-aparte': { security: 71, resilience: 45, usability: 100, inheritance: 64 },
  'r06-passphrase-solo-memoria': { security: 73, resilience: 28, usability: 100, inheritance: 0 },
  'r07-coldcard-afectada': { security: 12, resilience: 61, usability: 100, inheritance: 76 },
  'r08-2de3-todo-en-casa': { security: 53, resilience: 65, usability: 100, inheritance: 78 },
  'r09-2de3-distribuido': { security: 71, resilience: 72, usability: 100, inheritance: 77 },
  'r10-2de3-custodio': { security: 71, resilience: 75, usability: 100, inheritance: 77 },
  'r11-2de3-sin-herencia': { security: 71, resilience: 56, usability: 100, inheritance: 0 },
  'r12-2de3-seedsigner': { security: 65, resilience: 62, usability: 75, inheritance: 77 },
  'singlesig-passphrase': { security: 73, resilience: 45, usability: 100, inheritance: 64 },
  'todo-en-casa': { security: 69, resilience: 66, usability: 100, inheritance: 77 },
};
