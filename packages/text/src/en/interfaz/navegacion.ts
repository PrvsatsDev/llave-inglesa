import type { banner as esBanner, navegacion as es } from '../../es/interfaz/navegacion.ts';

/** Sections, metrics, breadcrumbs and the simulation banner over the map. */
export const navegacion: typeof es = {
  secciones: { schema: 'Setup', analysis: 'Analysis', simulate: 'Simulate' },
  metricas: { security: 'Security', resilience: 'Resilience', usability: 'Usability', inheritance: 'Inheritance' },
  introSeccion: {
    schema: 'Which keys there are, where everything is and who knows what. Click any item, here or on the map, to edit it.',
    simulate: 'Combine attacks or loss events and see on the map what would happen.',
  },
  introMetrica: {
    security: 'Combinations of attacks with which someone could spend your funds, from the cheapest to the most expensive.',
    resilience: 'Loss events after which the funds would be gone forever, or locked for a while.',
    usability: 'What it takes to sign day to day.',
    inheritance: 'Whether your heirs could recover the funds.',
  },
  introGuia: 'How to use llave-inglesa, step by step. The buttons open examples and simulate on the map without leaving the guide.',
  tipos: { location: 'Location', person: 'Person', device: 'Device', artifact: 'Backup', key: 'Key' },
  nombreSecciones: 'Sections',
  errores: (n: number) => (n === 1 ? '1 error in the model' : `${n} errors in the model`),
  avisos: (n: number) => (n === 1 ? '1 warning in the model' : `${n} warnings in the model`),
  simulacionActiva: 'There is a simulation on the map',
  activa: 'active',
  plegar: 'Collapse the panel',
  pistaPlegar: 'Collapse the panel to see more of the map',
  via: (n: number, de: number) => `Route ${n} of ${de}`,
  viaModificada: 'Modified route',
  simulacion: 'Simulation',
  guia: 'Guide',
  capitulos: 'Chapters',
  abierto: 'open',
  enElMapa: 'on the map',
  video: 'Introduction video',
  duracionVideo: '50 s',
  videoNoIncluido: 'The video is not included in this copy of the app.',
  verVideoEnLaWeb: 'Watch it at llave-inglesa.vualt.net',

  volver: 'Back',
  pistaVolver: 'Back (Esc)',
  estasEn: 'You are in',
  viaAnterior: 'Previous route',
  viaSiguiente: 'Next route',
};

export const banner: typeof esBanner = {
  resultado: {
    stolen: 'The attacker can spend your funds',
    safe: 'Not enough to steal',
    recoverable: 'The funds are still recoverable',
    lockout: 'Locked until the death; recoverable afterwards',
    lost: 'Funds lost forever',
  },
  simulandoAtaque: 'Simulating an attack',
  simulandoDesgracia: 'Simulating a loss event',
  coaccion: 'Defeating a duress PIN',
  comprometidos: ['compromised device', 'compromised devices'],
  yAdemas: 'And it also',
  pero: 'But it',
  veSaldo: 'sees your balance and history',
  salir: 'Leave the simulation',
  pistaSalir: 'Leave (Esc)',
};
