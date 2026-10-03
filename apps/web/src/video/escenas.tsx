import { indexModel } from '@llave-inglesa/domain';
import { analyze } from '@llave-inglesa/engine';
import { CIFRAS } from '@llave-inglesa/text';
import type { ComponentType } from 'react';
import { attackText, inheritanceText, lossText } from '../lib/text.ts';
import type { Scenario } from '../scenario/view.ts';
import { Aviso, ejemplo, Llamas, Mapa, Tarjeta, Titulo, type EstadoMapa } from './piezas.tsx';
import type { Sonido } from './sonido.ts';
import { interpolar, suave } from './tiempo.ts';
import styles from './video.module.css';

export interface Escena {
  id: string;
  titulo: string;
  fotogramas: number;
  Componente: ComponentType<{ f: number }>;
  /** Efectos de sonido, en fotogramas de la escena. */
  sonidos?: readonly Sonido[];
}

/** Tics cada `cada` fotogramas entre `desde` y `hasta` (una cifra que cuenta). */
const tics = (desde: number, hasta: number, cada = 3): Sonido[] =>
  Array.from({ length: Math.floor((hasta - desde) / cada) }, (_, k) => ({ f: desde + k * cada, tipo: 'tic' }));

// ---------- Los dos esquemas del vídeo ----------

const PAPEL = 'r01-papel-en-casa';
const DISTRIBUIDO = 'r09-2de3-distribuido';
const papel = ejemplo(PAPEL);
const distribuido = ejemplo(DISTRIBUIDO);

/** «Papel en el cajón»: Casa y Yo, grandes y centrados bajo el título. */
function mapaPapel(e: Partial<EstadoMapa> = {}): EstadoMapa {
  return {
    modelo: papel,
    nodos: { casa: 1, yo: 1 },
    lineas: 1,
    posiciones: { casa: { x: 0, y: 0 }, yo: { x: 40, y: 230 } },
    vista: { x: 960 - 150 * 1.7, y: 310, zoom: 1.7 },
    ...e,
  };
}

/** «2 de 3 distribuido»: las cuatro ubicaciones en fila (1416 px de ancho a 1×), centradas. */
const VISTA_DISTRIBUIDO = { x: (1920 - 1416 * 1.1) / 2, y: 220, zoom: 1.1 };

// Las cuatro notas de cada uno, tal como las calcula el motor (las mismas que cita la guía).
const METRICAS = [
  ['security', 'Seguridad'],
  ['resilience', 'Resiliencia'],
  ['usability', 'Usabilidad'],
  ['inheritance', 'Herencia'],
] as const;

// ---------- Escenas ----------

const TEXTO_1 = 'Tu frase semilla, en un papel en casa.';
const TEXTO_2 = 'Basta con que alguien entre.';
const TEXTO_3 = 'O con un incendio.';
const INTRUSION: Scenario = { kind: 'attack', atoms: [{ type: 'burglary', location: 'casa' }] };
const INCENDIO: Scenario = { kind: 'loss', events: [{ type: 'destroy-location', location: 'casa', disaster: 'fire' }] };

/** 1 · El punto de partida (6 s): Casa con un Trezor y la frase semilla en papel; Yo, que entra en ella. */
function Escena1({ f }: { f: number }) {
  return (
    <div className={styles.escena}>
      <Mapa
        estado={mapaPapel({
          nodos: { casa: interpolar(f, 15, 40), yo: interpolar(f, 60, 78) },
          objetos: { casa: [interpolar(f, 32, 50), interpolar(f, 42, 60)] },
          lineas: interpolar(f, 70, 92),
        })}
      />
      <Titulo f={f} texto={TEXTO_1} inicio={75} />
    </div>
  );
}

/** 2 · El ataque (6 s): una intrusión en casa basta; la seguridad cae. */
function Escena2({ f }: { f: number }) {
  return (
    <div className={styles.escena}>
      <Mapa estado={mapaPapel(f >= 18 ? { escenario: INTRUSION } : {})} />
      <div className={styles.destello} style={{ opacity: interpolar(f, 18, 24) - interpolar(f, 24, 45) }} />
      <Titulo f={f} texto={TEXTO_1} inicio={-200} salida={0} />
      <Titulo f={f} texto={TEXTO_2} inicio={70} />
      <Tarjeta
        etiqueta="Seguridad"
        valor={interpolar(f, 55, 105, 100, CIFRAS[PAPEL]!.security, suave.entradaSalida)}
        visible={interpolar(f, 25, 45)}
        style={{ left: 330, top: 470 }}
      />
    </div>
  );
}

/** 3 · La desgracia (6 s): un incendio quema el papel y el Trezor; la resiliencia cae. */
function Escena3({ f }: { f: number }) {
  return (
    <div className={styles.escena}>
      <Mapa
        estado={mapaPapel({
          ...(f >= 20 ? { escenario: INCENDIO } : f < 8 ? { escenario: INTRUSION } : {}),
          tachados: { casa: interpolar(f, 30, 45) },
        })}
      />
      <div className={`${styles.destello} ${styles.fuego}`} style={{ opacity: interpolar(f, 20, 26) - interpolar(f, 26, 50) }} />
      <Llamas f={f} intensidad={interpolar(f, 20, 45)} />
      <Aviso modelo={papel} escenario={INCENDIO} visible={interpolar(f, 45, 65)} />
      <Titulo f={f} texto={TEXTO_2} inicio={-200} salida={0} />
      <Titulo f={f} texto={TEXTO_3} inicio={70} />
      <Tarjeta etiqueta="Seguridad" valor={CIFRAS[PAPEL]!.security} visible={1} style={{ left: 330, top: 470 }} />
      <Tarjeta
        etiqueta="Resiliencia"
        valor={interpolar(f, 55, 105, 100, CIFRAS[PAPEL]!.resilience, suave.entradaSalida)}
        visible={interpolar(f, 25, 45)}
        style={{ left: 330, top: 680 }}
      />
    </div>
  );
}

/** 4 · Mejorar (10 s): el esquema se reparte en un 2 de 3 y las cuatro notas suben. */
function Escena4({ f }: { f: number }) {
  const fuera = interpolar(f, 0, 25, 1, 0);
  const aparece = (inicio: number) => interpolar(f, inicio, inicio + 20);
  const subida = (m: (typeof METRICAS)[number][0]) =>
    interpolar(f, 180, 245, CIFRAS[PAPEL]![m], CIFRAS[DISTRIBUIDO]![m], suave.entradaSalida);
  return (
    <div className={styles.escena}>
      {fuera > 0 && <Mapa estado={mapaPapel({ escenario: INCENDIO, opacidad: fuera, tachados: { casa: 1 } })} />}
      <Llamas f={180 + f} intensidad={fuera} />
      <Aviso modelo={papel} escenario={INCENDIO} visible={fuera} />
      {f >= 25 && (
        <Mapa
          estado={{
            modelo: distribuido,
            nodos: {
              casa: aparece(30),
              'nueva-ubicacion': aparece(50),
              'nueva-ubicacion-2': aparece(70),
              'nueva-ubicacion-3': aparece(90),
              yo: aparece(110),
              'nueva-persona': aparece(120),
            },
            objetos: { casa: [0, 1, 2, 3].map((k) => aparece(38 + k * 6)) },
            lineas: interpolar(f, 130, 170),
            vista: VISTA_DISTRIBUIDO,
          }}
        />
      )}
      <Titulo f={f} texto={TEXTO_3} inicio={-200} salida={0} />
      <Titulo f={f} texto="Reparte. Combina. Prueba." inicio={40} paso={14} />
      <Tarjeta etiqueta="Seguridad" valor={CIFRAS[PAPEL]!.security} visible={fuera} style={{ left: 330, top: 470 }} />
      <Tarjeta etiqueta="Resiliencia" valor={CIFRAS[PAPEL]!.resilience} visible={fuera} style={{ left: 330, top: 680 }} />
      {METRICAS.map(([m, etiqueta], k) => (
        <Tarjeta
          key={m}
          etiqueta={etiqueta}
          valor={subida(m)}
          visible={interpolar(f, 150 + k * 6, 170 + k * 6)}
          escala={1.5}
          style={{ left: 390 + k * 295, top: 850 }}
        />
      ))}
    </div>
  );
}

const FALLECIMIENTO: Scenario = { kind: 'loss', events: [{ type: 'death', person: 'yo' }] };
const NODOS_DISTRIBUIDO = { casa: 1, 'nueva-ubicacion': 1, 'nueva-ubicacion-2': 1, 'nueva-ubicacion-3': 1, yo: 1, 'nueva-persona': 1 };

/** 5 · La herencia (7 s): si faltas tú, tu pareja sigue llegando a los fondos. */
function EscenaHerencia({ f }: { f: number }) {
  // La tarjeta de Herencia se queda sola, a la izquierda; el aviso ocupa el centro de abajo.
  const aIzquierda = interpolar(f, 10, 40, 0, 1, suave.entradaSalida);
  return (
    <div className={styles.escena}>
      <Mapa estado={{ modelo: distribuido, nodos: NODOS_DISTRIBUIDO, lineas: 1, vista: VISTA_DISTRIBUIDO, ...(f >= 45 && { escenario: FALLECIMIENTO }) }} />
      <div className={styles.destello} style={{ opacity: (interpolar(f, 45, 51) - interpolar(f, 51, 75)) * 0.6 }} />
      <Titulo f={f} texto="Reparte. Combina. Prueba." inicio={-200} salida={0} />
      <Titulo f={f} texto="¿Y si faltas tú?" inicio={20} salida={110} />
      <Titulo f={f} texto="Tu familia sabría llegar." inicio={130} />
      {METRICAS.map(([m, etiqueta], k) =>
        m === 'inheritance' ? (
          <Tarjeta
            key={m}
            etiqueta={etiqueta}
            valor={CIFRAS[DISTRIBUIDO]![m]}
            visible={1}
            escala={1.5}
            style={{ left: 390 + k * 295 + (120 - (390 + k * 295)) * aIzquierda, top: 850 }}
          />
        ) : (
          <Tarjeta key={m} etiqueta={etiqueta} valor={CIFRAS[DISTRIBUIDO]![m]} visible={interpolar(f, 0, 20, 1, 0)} escala={1.5} style={{ left: 390 + k * 295, top: 850 }} />
        ),
      )}
      <Aviso modelo={distribuido} escenario={FALLECIMIENTO} visible={interpolar(f, 60, 80)} />
    </div>
  );
}

// El análisis real del 2 de 3 distribuido: lo que enseña la escena 5.
const analisis = analyze(distribuido);
const indice = indexModel(distribuido);
const numero = (n: number) => n.toLocaleString('es');
const COLUMNAS = [
  {
    titulo: 'Cómo podrían robarte',
    filas: analisis.security.cuts
      .slice(0, 3)
      .map((cut, i) => [cut.map((a) => attackText(a, indice)).join(' + '), `esfuerzo ${numero(analisis.security.efforts[i]!)}`]),
  },
  {
    titulo: 'Qué te lo haría perder',
    filas: analisis.resilience.cuts
      .slice(0, 3)
      .map((cut, i) => [cut.map((e) => lossText(e, indice)).join(' + '), `rareza ${numero(analisis.resilience.rarities[i]!)}`]),
  },
  {
    titulo: 'Si tus herederos llegarían',
    filas: [
      [inheritanceText(analisis.inheritance, distribuido.people), ''],
      ...analisis.inheritance.losses.slice(0, 2).map((cut) => [`Salvo: ${cut.map((e) => lossText(e, indice)).join(' + ')}`, '']),
    ],
  },
] as const;

/** 6 · El porqué (8 s): el análisis real de ese esquema, en tres columnas. */
function Escena5({ f }: { f: number }) {
  return (
    <div className={styles.escena}>
      <Mapa
        estado={{
          modelo: distribuido,
          nodos: NODOS_DISTRIBUIDO,
          lineas: 1,
          vista: VISTA_DISTRIBUIDO,
          escenario: FALLECIMIENTO,
          opacidad: interpolar(f, 0, 30, 1, 0.12),
        }}
      />
      <Titulo f={f} texto="Tu familia sabría llegar." inicio={-200} salida={0} />
      <Tarjeta etiqueta="Herencia" valor={CIFRAS[DISTRIBUIDO]!.inheritance} visible={interpolar(f, 0, 20, 1, 0)} escala={1.5} style={{ left: 120, top: 850 }} />
      <Aviso modelo={distribuido} escenario={FALLECIMIENTO} visible={interpolar(f, 0, 20, 1, 0)} />
      <div className={styles.columnas}>
        {COLUMNAS.map((c, k) => (
          <section key={c.titulo} className={styles.columna} style={{ opacity: interpolar(f, 25 + k * 15, 45 + k * 15) }}>
            <h2>{c.titulo}</h2>
            <ul>
              {c.filas.map(([texto, meta], i) => (
                <li key={i} style={{ opacity: interpolar(f, 40 + k * 15 + i * 8, 55 + k * 15 + i * 8) }}>
                  <span>{texto}</span>
                  {meta && <span className={styles.meta}>{meta}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Titulo f={f} texto="Y siempre te dice por qué." inicio={120} />
    </div>
  );
}

/** 7 · Cierre (7 s): el logo, la frase y dónde probarlo. */
function Escena6({ f }: { f: number }) {
  const logo = interpolar(f, 10, 40);
  return (
    <div className={`${styles.escena} ${styles.cierre}`}>
      <img src="/logo.svg" alt="" width={220} height={220} style={{ opacity: logo, transform: `scale(${0.85 + 0.15 * logo}) rotate(${(1 - logo) * -12}deg)` }} />
      <p className={styles.marca} style={{ opacity: interpolar(f, 30, 50) }}>
        llave-inglesa
      </p>
      <p className={styles.lema} style={{ opacity: interpolar(f, 55, 80) }}>
        Pon a prueba la custodia de tus bitcoins antes de que lo haga otro.
      </p>
      <p className={styles.url} style={{ opacity: interpolar(f, 95, 115) }}>
        llave-inglesa.vualt.net
      </p>
      <p className={styles.promesa} style={{ opacity: interpolar(f, 125, 145) }}>
        Sin red · sin cuentas · código abierto
      </p>
    </div>
  );
}

export const ESCENAS: readonly Escena[] = [
  { id: 'escena-1', titulo: 'El punto de partida', fotogramas: 180, Componente: Escena1 },
  { id: 'escena-2', titulo: 'El ataque', fotogramas: 180, Componente: Escena2 },
  {
    id: 'escena-3',
    titulo: 'La desgracia',
    fotogramas: 180,
    Componente: Escena3,
    sonidos: [
      { f: 20, tipo: 'golpe' },
      { f: 20, tipo: 'fuego', dur: 5.4 },
      { f: 25, tipo: 'whoosh' },
      ...tics(55, 105),
      { f: 45, tipo: 'grave' },
    ],
  },
  { id: 'escena-4', titulo: 'Mejorar', fotogramas: 300, Componente: Escena4 },
  { id: 'escena-5', titulo: 'La herencia', fotogramas: 210, Componente: EscenaHerencia },
  { id: 'escena-6', titulo: 'El porqué', fotogramas: 240, Componente: Escena5 },
  { id: 'escena-7', titulo: 'Cierre', fotogramas: 210, Componente: Escena6 },
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

/** Todos los sonidos del vídeo, con su fotograma en el vídeo completo. */
export function sonidosDelVideo(): { f: number; sonido: Sonido }[] {
  let inicio = 0;
  return ESCENAS.flatMap((e) => {
    const lista = (e.sonidos ?? []).map((sonido) => ({ f: inicio + sonido.f, sonido }));
    inicio += e.fotogramas;
    return lista;
  });
}

/** Primer fotograma de cada escena en el vídeo completo. */
export function inicioDe(id: string): number {
  let inicio = 0;
  for (const e of ESCENAS) {
    if (e.id === id) return inicio;
    inicio += e.fotogramas;
  }
  throw new Error(`No existe la escena ${id}`);
}
