import { CIFRAS } from '@llave-inglesa/text';
import { ejemplo, Mapa, Tarjeta } from './piezas.tsx';
import styles from './video.module.css';

export const PORTADA = { ancho: 1200, alto: 630 };

const DISTRIBUIDO = 'r09-2de3-distribuido';
const METRICAS = [
  ['security', 'Seguridad'],
  ['resilience', 'Resiliencia'],
  ['usability', 'Usabilidad'],
  ['inheritance', 'Herencia'],
] as const;

/**
 * Imagen de vista previa del enlace (og:image, 1200×630): la frase a la izquierda y, a la derecha, las
 * cuatro notas reales de un 2 de 3 repartido, con su mapa de fondo. La captura scripts/portada.ts.
 */
export function Portada() {
  const cifras = CIFRAS[DISTRIBUIDO]!;
  return (
    <div className={`${styles.lienzo} ${styles.portada}`} style={{ width: PORTADA.ancho, height: PORTADA.alto }}>
      <div className={styles.portadaFondo}>
        <Mapa
          estado={{
            modelo: ejemplo(DISTRIBUIDO),
            nodos: { casa: 1, 'nueva-ubicacion': 1, 'nueva-ubicacion-2': 1, 'nueva-ubicacion-3': 1, yo: 1, 'nueva-persona': 1 },
            lineas: 1,
            vista: { x: 360, y: 60, zoom: 0.85 },
            opacidad: 0.22,
          }}
        />
      </div>
      <div className={styles.portadaTexto}>
        <div className={styles.portadaMarca}>
          <img src="/logo.svg" alt="" width={72} height={72} />
          <span>llave-inglesa</span>
        </div>
        <h1>
          Simula tu custodia
          <br />
          de Bitcoin
        </h1>
        <ul>
          <li>Qué robo te deja sin fondos.</li>
          <li>Con qué desgracia los pierdes.</li>
          <li>¿Tus herederos llegan?</li>
        </ul>
        <p className={styles.portadaPie}>Sin red · sin cuentas · código abierto</p>
      </div>
      {METRICAS.map(([m, etiqueta], k) => (
        <Tarjeta
          key={m}
          etiqueta={etiqueta}
          valor={cifras[m]}
          visible={1}
          escala={1.3}
          style={{ left: 690 + (k % 2) * 240, top: 170 + Math.floor(k / 2) * 150 }}
        />
      ))}
      <p className={styles.portadaPieDerecha}>Un 2 de 3 repartido, analizado</p>
    </div>
  );
}
