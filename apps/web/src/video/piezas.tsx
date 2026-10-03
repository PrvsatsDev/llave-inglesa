import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider, type Edge, type Node, type NodeTypes } from '@xyflow/react';
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
const ZOOM = 1.7;

/** El ejemplo de las primeras escenas: «Papel en el cajón». */
const modelo = examples.find((e) => e.id === 'r01-papel-en-casa')!.model;

/** Cómo se ve cada parte del mapa en un fotograma (0 = oculta, 1 = del todo). */
export interface EstadoMapa {
  casa: number;
  objetos: [number, number];
  yo: number;
  linea: number;
  /** Simulación aplicada sobre el mapa, si la hay. */
  escenario?: Scenario;
}

/** El mapa real de la app (Casa y Yo de «Papel en el cajón»), con encuadre fijo bajo el título. */
export function Mapa({ estado }: { estado: EstadoMapa }) {
  const grafo = applyScenario(buildGraph(modelo), estado.escenario ? scenarioView(modelo, estado.escenario) : null);
  const nodes: Node[] = grafo.nodes
    .filter((n) => n.id === 'casa' || n.id === 'yo')
    .map((n) => {
      const p = n.id === 'casa' ? estado.casa : estado.yo;
      const style = {
        opacity: p,
        '--escala': 0.94 + 0.06 * p,
        ...(n.id === 'casa' && { '--obj1': estado.objetos[0], '--obj2': estado.objetos[1] }),
      } as CSSProperties;
      return { ...n, position: n.id === 'casa' ? { x: 0, y: 0 } : { x: 40, y: 230 }, style };
    });
  const edges: Edge[] = grafo.edges
    .filter((e) => e.source === 'yo' && e.target === 'casa')
    .map((e) => ({ ...e, style: { strokeDasharray: 600, strokeDashoffset: 600 * (1 - estado.linea), opacity: estado.linea > 0 ? 1 : 0 } }));
  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="dark"
        // Encuadre fijo: la casa (300 px de ancho) centrada bajo el título.
        defaultViewport={{ x: 960 - 150 * ZOOM, y: 310, zoom: ZOOM }}
        minZoom={ZOOM}
        maxZoom={ZOOM}
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
export function Tarjeta({ etiqueta, valor, visible, style }: { etiqueta: string; valor: number; visible: number; style?: CSSProperties }) {
  const v = Math.round(valor);
  const { icon: Icon, text } = level(v);
  return (
    <div className={styles.tarjeta} style={{ ...style, opacity: visible, transform: `translateY(${(1 - visible) * 20}px) scale(2)` }}>
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
