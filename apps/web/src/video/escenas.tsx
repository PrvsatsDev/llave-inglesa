import type { ComponentType } from 'react';
import { Mapa, Tarjeta, Titulo } from './piezas.tsx';
import { interpolar, suave } from './tiempo.ts';
import styles from './video.module.css';

export interface Escena {
  id: string;
  titulo: string;
  fotogramas: number;
  Componente: ComponentType<{ f: number }>;
}

const TEXTO_1 = 'Tu frase semilla, en un papel en casa.';

/** Escena 1 (6 s): el punto de partida. Casa con un Trezor y la frase semilla en papel; Yo, que entra en ella. */
function Escena1({ f }: { f: number }) {
  return (
    <div className={styles.escena}>
      <Mapa
        estado={{
          casa: interpolar(f, 15, 40),
          objetos: [interpolar(f, 32, 50), interpolar(f, 42, 60)],
          yo: interpolar(f, 60, 78),
          linea: interpolar(f, 70, 92),
        }}
      />
      <Titulo f={f} texto={TEXTO_1} inicio={75} />
    </div>
  );
}

/** Escena 2 (6 s): el ataque. Una intrusión en casa basta: la seguridad cae a 35. */
function Escena2({ f }: { f: number }) {
  const ataque = f >= 18;
  const destello = interpolar(f, 18, 24) - interpolar(f, 24, 45);
  const visible = interpolar(f, 25, 45);
  const seguridad = interpolar(f, 55, 105, 100, 35, suave.entradaSalida);
  return (
    <div className={styles.escena}>
      <Mapa
        estado={{
          casa: 1,
          objetos: [1, 1],
          yo: 1,
          linea: 1,
          ...(ataque && { escenario: { kind: 'attack', atoms: [{ type: 'burglary', location: 'casa' }] } }),
        }}
      />
      <div className={styles.destello} style={{ opacity: destello }} />
      <Titulo f={f} texto={TEXTO_1} inicio={-200} salida={0} />
      <Titulo f={f} texto="Basta con que alguien entre." inicio={70} />
      <Tarjeta etiqueta="Seguridad" valor={seguridad} visible={visible} style={{ left: 330, top: 470 }} />
    </div>
  );
}

export const ESCENAS: readonly Escena[] = [
  { id: 'escena-1', titulo: 'El punto de partida', fotogramas: 180, Componente: Escena1 },
  { id: 'escena-2', titulo: 'El ataque', fotogramas: 180, Componente: Escena2 },
];

export const DURACION = ESCENAS.reduce((s, e) => s + e.fotogramas, 0);

/** Qué escena toca en un fotograma del vídeo completo, y en qué fotograma de ella. */
export function escenaEn(f: number): { escena: Escena; local: number } {
  let resto = f;
  for (const escena of ESCENAS) {
    if (resto < escena.fotogramas) return { escena, local: resto };
    resto -= escena.fotogramas;
  }
  const ultima = ESCENAS[ESCENAS.length - 1]!;
  return { escena: ultima, local: ultima.fotogramas - 1 };
}
