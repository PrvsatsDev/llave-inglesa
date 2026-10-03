import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider, type Edge, type Node, type NodeTypes } from '@xyflow/react';
import type { CustodyModel } from '@llave-inglesa/domain';
import { scoreBand } from '@llave-inglesa/engine';
import type { CSSProperties } from 'react';
import { applyScenario, buildGraph } from '../graph/build.ts';
import { LocationNode } from '../graph/LocationNode.tsx';
import { PersonNode } from '../graph/PersonNode.tsx';
import { examples } from '../lib/examples.ts';
import { scenarioView, type Scenario } from '../scenario/view.ts';
import { level } from '../components/Scoreboard.tsx';
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
}

/** El mapa real de la app, con los nodos y las líneas que digan el estado, y un encuadre fijo. */
export function Mapa({ estado }: { estado: EstadoMapa }) {
  const { modelo, nodos: visibles, objetos = {}, lineas, posiciones = {}, vista } = estado;
  const grafo = applyScenario(buildGraph(modelo), estado.escenario ? scenarioView(modelo, estado.escenario) : null);
  const nodes: Node[] = grafo.nodes
    .filter((n) => n.id in visibles)
    .map((n) => {
      const p = visibles[n.id]!;
      const style = {
        opacity: p,
        '--escala': 0.94 + 0.06 * p,
        ...Object.fromEntries((objetos[n.id] ?? []).map((v, k) => [`--obj${k + 1}`, v])),
      } as CSSProperties;
      return { ...n, position: posiciones[n.id] ?? n.position, style };
    });
  const edges: Edge[] = grafo.edges
    .filter((e) => e.source in visibles && e.target in visibles)
    .map((e) => {
      const l = typeof lineas === 'number' ? lineas : (lineas[e.id] ?? 0);
      return { ...e, style: { strokeDasharray: 900, strokeDashoffset: 900 * (1 - l), opacity: l > 0 ? 1 : 0 } };
    });
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
