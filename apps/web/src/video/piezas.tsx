import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider, type Edge, type Node, type NodeTypes } from '@xyflow/react';
import { indexModel, type CustodyModel } from '@llave-inglesa/domain';
import { scoreBand } from '@llave-inglesa/engine';
import { useMemo, type CSSProperties } from 'react';
import { applyScenario, buildGraph } from '../graph/build.ts';
import { LocationNode } from '../graph/LocationNode.tsx';
import { PersonNode } from '../graph/PersonNode.tsx';
import { examples } from '../lib/examples.ts';
import { scenarioView, type Scenario } from '../scenario/view.ts';
import { level } from '../components/Scoreboard.tsx';
import { OUTCOME } from '../components/ScenarioBanner.tsx';
import aviso from '../components/ScenarioBanner.module.css';
import { attackText, lossText } from '../lib/text.ts';
import tarjeta from '../components/Scoreboard.module.css';
import { interpolar } from './tiempo.ts';
import styles from './video.module.css';

const nodeTypes: NodeTypes = { location: LocationNode, person: PersonNode };

export const ejemplo = (id: string) => examples.find((e) => e.id === id)!.model;

/** Cómo se ve el mapa en un fotograma: qué se muestra (0 = oculto, 1 = del todo) y dónde. */
export interface EstadoMapa {
  modelo: CustodyModel;
  /** Nodos visibles y cuánto: los que no están no se pintan. */
  nodos: Record<string, number>;
  /** Objetos de cada ubicación que van entrando (por orden): si falta, se ven todos. */
  objetos?: Record<string, number[]>;
  /** Líneas, por id (o una para todas): cuánto están dibujadas. */
  lineas: number | Record<string, number>;
  /** Posiciones a mano; si no, las del mapa de la app. */
  posiciones?: Record<string, { x: number; y: number }>;
  vista: { x: number; y: number; zoom: number };
  /** Simulación aplicada sobre el mapa, si la hay. */
  escenario?: Scenario;
  /** Opacidad de todo el mapa. */
  opacidad?: number;
  /** Nodos tachados (en gris, con un aspa roja encima). */
  tachados?: Record<string, number>;
}

/** El mapa real de la app, con los nodos y las líneas que digan el estado, y un encuadre fijo. */
export function Mapa({ estado }: { estado: EstadoMapa }) {
  const { modelo, nodos: visibles, objetos = {}, lineas, posiciones = {}, vista } = estado;
  // Nodos y líneas solo cambian si cambia lo que los dibuja; mientras tanto se pasan los mismos objetos.
  // Si no, React Flow repasa sus medidas en cada fotograma, vuelve a montar las líneas y sus etiquetas
  // («tras fallecer Yo») salen un instante sin medir: parpadean en el reproductor.
  const escenario = estado.escenario ?? null;
  const grafo = useMemo(
    () => applyScenario(buildGraph(modelo), escenario ? scenarioView(modelo, escenario) : null),
    [modelo, JSON.stringify(escenario)],
  );
  const claveNodos = JSON.stringify({ visibles, objetos, posiciones, tachados: estado.tachados ?? {} });
  const nodes = useMemo<Node[]>(
    () =>
      grafo.nodes
        .filter((n) => n.id in visibles)
        .map((n) => {
          const p = visibles[n.id]!;
          const style = {
            opacity: p,
            '--escala': 0.94 + 0.06 * p,
            ...Object.fromEntries((objetos[n.id] ?? []).map((v, k) => [`--obj${k + 1}`, v])),
          } as CSSProperties;
          const tachado = estado.tachados?.[n.id] ?? 0;
          if (tachado > 0) Object.assign(style, { '--tachado': tachado });
          return { ...n, position: posiciones[n.id] ?? n.position, style, className: tachado > 0 ? styles.tachado : undefined };
        }),
    [grafo, claveNodos],
  );
  const claveLineas = JSON.stringify({ lineas, nodos: Object.keys(visibles) });
  const edges = useMemo<Edge[]>(
    () =>
      grafo.edges
        .filter((e) => e.source in visibles && e.target in visibles)
        .map((e) => {
          const l = typeof lineas === 'number' ? lineas : (lineas[e.id] ?? 0);
          // La etiqueta se pinta aparte: aparece cuando la línea ya está casi dibujada.
          const etiqueta = interpolar(l, 0.7, 1);
          return {
            ...e,
            style: { strokeDasharray: 900, strokeDashoffset: 900 * (1 - l), opacity: l > 0 ? 1 : 0 },
            labelStyle: { opacity: etiqueta },
            labelBgStyle: { opacity: etiqueta },
            ...(etiqueta === 0 && { label: undefined }),
          };
        }),
    [grafo, claveLineas],
  );
  return (
    <div className={styles.escena} style={{ opacity: estado.opacidad ?? 1 }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode="dark"
          defaultViewport={vista}
          minZoom={vista.zoom}
          maxZoom={vista.zoom}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--border-strong)" />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}

/** Texto grande arriba: entra palabra a palabra desde `inicio` y, si se indica, se va en `salida`. */
export function Titulo({ f, texto, inicio, paso = 9, salida }: { f: number; texto: string; inicio: number; paso?: number; salida?: number }) {
  const fuera = salida === undefined ? 1 : interpolar(f, salida, salida + 15, 1, 0);
  return (
    <h1 className={styles.titulo} aria-label={texto} style={{ opacity: fuera }}>
      {texto.split(' ').map((p, i) => {
        const v = interpolar(f, inicio + i * paso, inicio + i * paso + 20);
        return (
          <span key={i} style={{ opacity: v, transform: `translateY(${(1 - v) * 18}px)` }}>
            {p}{' '}
          </span>
        );
      })}
    </h1>
  );
}

/** Una tarjeta de puntuación con los estilos de la app, para un valor que puede ir cambiando. */
export function Tarjeta({ etiqueta, valor, visible, escala = 2, style }: { etiqueta: string; valor: number; visible: number; escala?: number; style?: CSSProperties }) {
  const v = Math.round(valor);
  const { icon: Icon, text } = level(v);
  return (
    <div className={styles.tarjeta} style={{ ...style, opacity: visible, transform: `translateY(${(1 - visible) * 20}px) scale(${escala})` }}>
      <div className={`${tarjeta.tile} ${tarjeta[scoreBand(v)]}`}>
        <div className={tarjeta.top}>
          <span className={tarjeta.label}>{etiqueta}</span>
        </div>
        <div className={tarjeta.valueRow}>
          <span className={tarjeta.value}>{v}</span>
          <span className={tarjeta.status}>
            <Icon size={13} aria-hidden /> {text}
          </span>
        </div>
        <div className={tarjeta.meter}>
          <span className={tarjeta.fill} style={{ '--value': `${v}%` } as CSSProperties} />
        </div>
      </div>
    </div>
  );
}

/** El aviso de simulación de la app (mismo aspecto y mismos textos), para un escenario sobre un modelo. */
export function Aviso({ modelo, escenario, visible }: { modelo: CustodyModel; escenario: Scenario; visible: number }) {
  const view = scenarioView(modelo, escenario);
  if (!view) return null;
  const index = indexModel(modelo);
  const { icon: Icon, text, level } = OUTCOME[view.outcome];
  const pasos = escenario.kind === 'attack' ? escenario.atoms.map((a) => attackText(a, index)) : escenario.events.map((e) => lossText(e, index));
  return (
    <div className={styles.aviso} style={{ opacity: visible, transform: `translateX(-50%) translateY(${(1 - visible) * 20}px) scale(1.7)` }}>
      <div className={`${aviso.banner} ${aviso[level]}`}>
        <Icon size={18} className={aviso.icon} aria-hidden />
        <div className={aviso.text}>
          <span className={aviso.kicker}>{escenario.kind === 'attack' ? 'Simulando ataque' : 'Simulando desgracia'}</span>
          <span className={aviso.steps}>{pasos.join(' + ')}</span>
          <span className={aviso.outcome}>{text}</span>
        </div>
      </div>
    </div>
  );
}

/** Una llama dibujada, que oscila con el fotograma (`fase` la desfasa de las demás). */
function Llama({ f, fase, x, alto, intensidad }: { f: number; fase: number; x: number; alto: number; intensidad: number }) {
  const s = 1 + 0.08 * Math.sin(f * 0.45 + fase) + 0.04 * Math.sin(f * 1.3 + fase * 2);
  const inclinacion = 4 * Math.sin(f * 0.3 + fase);
  const forma = 'M50 0 C62 22 88 38 88 68 C88 92 70 110 50 110 C30 110 12 92 12 68 C12 46 30 40 34 22 C40 34 46 36 50 0 Z';
  return (
    <svg
      viewBox="0 0 100 110"
      className={styles.llama}
      style={{ left: x, height: alto * s * intensidad, transform: `rotate(${inclinacion}deg)` }}
      aria-hidden
    >
      <path d={forma} fill="var(--danger)" />
      <path d={forma} fill="var(--accent)" transform="translate(18 30) scale(0.64)" />
      <path d={forma} fill="var(--warn)" transform="translate(32 58) scale(0.36)" />
    </svg>
  );
}

/** Llamas en las esquinas de abajo (`intensidad` de 0 a 1: aparecen y se apagan). */
export function Llamas({ f, intensidad }: { f: number; intensidad: number }) {
  if (intensidad <= 0) return null;
  const llamas = [
    { x: -30, alto: 260, fase: 0 },
    { x: 90, alto: 190, fase: 2.1 },
    { x: 190, alto: 140, fase: 4.2 },
    { x: 1600, alto: 150, fase: 1.3 },
    { x: 1700, alto: 220, fase: 3.4 },
    { x: 1810, alto: 170, fase: 5.1 },
  ];
  return (
    <div className={styles.llamas} style={{ opacity: intensidad }}>
      {llamas.map((l, i) => (
        <Llama key={i} f={f} fase={l.fase} x={l.x} alto={l.alto} intensidad={intensidad} />
      ))}
    </div>
  );
}
