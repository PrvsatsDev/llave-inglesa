import type { dialogos as es } from '../../es/interfaz/dialogos.ts';

/** Modal dialogs: password, welcome and About. */
export const dialogos: typeof es = {
  contrasena: {
    etiqueta: 'Password',
    repetir: 'Repeat it',
    noCoinciden: 'They do not match.',
    siLaOlvidas: 'If you forget it, there is no way to recover the document.',
    cifrar: 'Encrypt',
    abrir: 'Open',
    minimo: (n: number) => `At least ${n} characters. A long phrase is better.`,
    fuerza: {
      corta: (n: number) => `Too short (at least ${n})`,
      fuerte: 'Strong',
      aceptable: 'Acceptable',
      debil: 'Weak: make it longer',
    },
  },
  copiarDireccion: (red: string) => `Copy the ${red} address`,
  hechaPor: 'Made by',
  nostr: 'Nostr',
  lightning: 'Lightning',
  silentPayments: 'Silent payments',
  lema: 'Put your bitcoin custody to the test before someone else does.',
  puntos: [
    'Describe which keys, devices and backups you have, where they are and who knows what.',
    'The tool works out how you could be robbed, which loss events would leave you without your funds, how easy it is to sign and whether your heirs would get to them. And it always explains why.',
    'Everything happens in your browser: no accounts, no network. You can save your setup encrypted.',
    'Rather not enter your real setup? Use it to practice, with a similar or made-up one and without saving anything: it will still uncover gaps you had not foreseen.',
  ],
  nuncaSecretos: 'Never type real seed phrases, private keys or passphrases: they are not needed.',
  verEjemplo: 'See an example',
  empezarDeCero: 'Start from scratch',
  abrirFichero: 'Open file',
  guiaRapida: 'First time? 5-minute guide',
  pistaEjemplos: (n: number) =>
    `The selector at the top has ${n} examples, from the most common to the most careful. You can read this again under "About" by clicking the logo.`,
  codigoAbierto: 'Open source (MIT) and verifiable: every version can be rebuilt and compared with the published one.',
  codigoEnGithub: 'Code on GitHub',
  guia: 'User guide',
};
