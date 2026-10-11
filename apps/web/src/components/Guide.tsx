import { useState } from 'react';
import { CIFRAS, GUIA, idioma, UI, type Bloque, type Capitulo, type Escenario, type Trozo } from '../lib/text.ts';
import { BookOpen, ChevronLeft, ChevronRight, Clapperboard, Lightbulb, Map as MapIcon, Play } from 'lucide-react';
import { loadExample } from '../storage/actions.ts';
import { useDocument } from '../store/document.ts';
import { useNavigation } from '../store/navigation.ts';
import { sameScenario, useScenario } from '../store/scenario.ts';
import { useSelection } from '../store/selection.ts';
import { Section } from './inspector/fields.tsx';
import { level } from './Scoreboard.tsx';
import styles from './Guide.module.css';

/** La guía de uso, al lado del mapa: índice o capítulo. */
export function Guide() {
  const chapter = useNavigation((s) => s.guide?.chapter ?? null);
  const current = GUIA.find((c) => c.id === chapter);
  return current ? <Chapter chapter={current} /> : <Index />;
}

function Index() {
  const openGuide = useNavigation((s) => s.openGuide);
  return (
    <Section>
      <Video />
      <ol className={styles.index}>
        {GUIA.map((c, i) => (
          <li key={c.id}>
            <button className={styles.indexItem} onClick={() => openGuide(c.id)}>
              <span className={styles.indexNumber}>{i + 1}</span>
              <span className={styles.indexText}>
                <span className={styles.indexTitle}>{c.titulo}</span>
                <span className={styles.indexSummary}>{c.resumen}</span>
              </span>
              <ChevronRight size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** La web publicada, que sí tiene el vídeo. */
const PUBLISHED = 'https://llave-inglesa.vualt.net';

/**
 * El vídeo de presentación, en el idioma activo. No está en el repo ni en el build: el servidor lo sirve
 * aparte en /medios/ (deploy/README.md). Si no está (un fork, el zip, Umbrel), se dice y se enlaza la web publicada.
 * `preload="metadata"` pide solo el principio del fichero: lo justo para saber si existe sin tener que pulsar.
 */
function Video() {
  const [missing, setMissing] = useState(false);
  const T = UI.navegacion;
  return (
    <figure className={styles.video}>
      <figcaption className={styles.videoCaption}>
        <Clapperboard size={14} aria-hidden /> {T.video} · {T.duracionVideo}
      </figcaption>
      {missing ? (
        <p className={styles.note}>
          <Lightbulb size={14} aria-hidden />
          <span>
            {T.videoNoIncluido}{' '}
            <a className={styles.link} href={PUBLISHED} target="_blank" rel="noopener noreferrer">
              {T.verVideoEnLaWeb}
            </a>
          </span>
        </p>
      ) : (
        <video
          className={styles.player}
          src={`/medios/llave-inglesa-${idioma()}.mp4`}
          controls
          preload="metadata"
          aria-label={T.video}
          onError={() => setMissing(true)}
        />
      )}
    </figure>
  );
}

function Chapter({ chapter }: { chapter: Capitulo }) {
  const openGuide = useNavigation((s) => s.openGuide);
  const at = GUIA.indexOf(chapter);
  const prev = GUIA[at - 1];
  const next = GUIA[at + 1];
  return (
    <Section>
      <article className={styles.chapter}>
        <h2 className={styles.title}>
          <BookOpen size={16} aria-hidden /> {chapter.titulo}
        </h2>
        {chapter.bloques.map((b, i) => (
          <Block key={i} block={b} />
        ))}
      </article>
      <nav className={styles.pager} aria-label={UI.navegacion.capitulos}>
        {prev ? (
          <button className={styles.pagerButton} onClick={() => openGuide(prev.id)}>
            <ChevronLeft size={14} aria-hidden /> {prev.titulo}
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button className={styles.pagerButton} onClick={() => openGuide(next.id)}>
            {next.titulo} <ChevronRight size={14} aria-hidden />
          </button>
        )}
      </nav>
    </Section>
  );
}

function Block({ block }: { block: Bloque }) {
  switch (block.tipo) {
    case 'parrafo':
      return (
        <p className={styles.p}>
          <Text parts={block.texto} />
        </p>
      );
    case 'lista':
      return (
        <ul className={styles.list}>
          {block.items.map((item, i) => (
            <li key={i}>
              <Text parts={item} />
            </li>
          ))}
        </ul>
      );
    case 'nota':
      return (
        <p className={styles.note}>
          <Lightbulb size={14} aria-hidden />
          <span>
            <Text parts={block.texto} />
          </span>
        </p>
      );
    case 'ejemplo':
      return <ExampleButton example={block.ejemplo} label={block.texto} />;
    case 'simular':
      return <SimulateButton example={block.ejemplo} scenario={block.escenario} label={block.texto} />;
  }
}

function Text({ parts }: { parts: readonly Trozo[] }) {
  return (
    <>
      {parts.map((t, i) => {
        if (typeof t === 'string') return <span key={i}>{t}</span>;
        if ('negrita' in t) return <strong key={i}>{t.negrita}</strong>;
        if ('enlace' in t)
          return (
            <a key={i} className={styles.link} href={t.enlace} target="_blank" rel="noopener noreferrer">
              {t.texto}
            </a>
          );
        if ('capitulo' in t) return <ChapterLink key={i} id={t.capitulo} label={t.texto} />;
        const value = CIFRAS[t.cifra.ejemplo]?.[t.cifra.metrica];
        if (value === undefined) return <span key={i}>?</span>;
        const { level: band, icon: Icon, text } = level(value);
        return (
          <span key={i} className={`${styles.score} ${styles[band]}`} title={text}>
            <Icon size={12} aria-hidden />
            {value} · {text.toLowerCase()}
          </span>
        );
      })}
    </>
  );
}

function ChapterLink({ id, label }: { id: string; label: string }) {
  const openGuide = useNavigation((s) => s.openGuide);
  return (
    <button type="button" className={styles.chapterLink} onClick={() => openGuide(id)}>
      {label}
    </button>
  );
}

const isOpen = (example: string) => {
  const { origin } = useDocument.getState();
  return origin.kind === 'example' && origin.id === example;
};

/** Abre el ejemplo si no está abierto (pide confirmación si hay cambios sin guardar). */
async function ensureExample(example: string): Promise<boolean> {
  return isOpen(example) || (await loadExample(example));
}

function ExampleButton({ example, label }: { example: string; label: string }) {
  const open = useDocument((s) => s.origin.kind === 'example' && s.origin.id === example);
  return (
    <button className={`${styles.action} ${open ? styles.done : ''}`} onClick={() => void ensureExample(example)}>
      <MapIcon size={14} aria-hidden /> {label}
      {open && <span className={styles.actionState}>{UI.navegacion.abierto}</span>}
    </button>
  );
}

/** Simula en el mapa sin salir de la guía. */
function SimulateButton({ example, scenario, label }: { example: string; scenario: Escenario; label: string }) {
  const open = useDocument((s) => s.origin.kind === 'example' && s.origin.id === example);
  const active = useScenario((s) => s.active);
  const on = open && sameScenario(active, scenario);
  const run = async () => {
    if (!(await ensureExample(example))) return;
    useSelection.getState().select(null);
    useScenario.getState().set(scenario);
  };
  return (
    <button className={`${styles.action} ${styles.simulate} ${on ? styles.done : ''}`} onClick={() => void run()} aria-pressed={on}>
      <Play size={14} aria-hidden /> {label}
      {on && <span className={styles.actionState}>{UI.navegacion.enElMapa}</span>}
    </button>
  );
}
