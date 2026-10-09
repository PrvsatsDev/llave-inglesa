import { Background, BackgroundVariant, Controls, ReactFlow, useEdgesState, useNodesState, type NodeTypes, type ReactFlowInstance } from '@xyflow/react';
import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { applyScenario, buildGraph, type AccessEdge, type GraphNode } from '../graph/build.ts';
import { LOCATION_WIDTH, PERSON_WIDTH } from '../graph/layout.ts';
import { LocationNode } from '../graph/LocationNode.tsx';
import { PersonNode } from '../graph/PersonNode.tsx';
import { useDocument } from '../store/document.ts';
import { showPanel, useNarrow } from '../store/mobile.ts';
import { useScenarioView } from '../store/scenario.ts';
import { useSelection } from '../store/selection.ts';
import { Legend } from './Legend.tsx';
import { ScenarioBanner } from './ScenarioBanner.tsx';
import styles from './Canvas.module.css';

const nodeTypes: NodeTypes = { location: LocationNode, person: PersonNode };

/** Margen alrededor del esquema al encuadrarlo en pantalla estrecha. */
const NARROW_PADDING = 12;

/**
 * En pantalla estrecha el esquema va en vertical: se encuadra al ancho y desde arriba, y se recorre bajando. Encuadrarlo
 * entero lo encogería otra vez en cuanto hubiera varias ubicaciones.
 */
function fitWidth(flow: ReactFlowInstance<GraphNode, AccessEdge>, container: HTMLElement) {
  const nodes = flow.getNodes();
  if (nodes.length === 0) return;
  const left = Math.min(...nodes.map((n) => n.position.x));
  const right = Math.max(...nodes.map((n) => n.position.x + (n.type === 'location' ? LOCATION_WIDTH : PERSON_WIDTH)));
  const top = Math.min(...nodes.map((n) => n.position.y));
  const zoom = Math.min(1, (container.clientWidth - 2 * NARROW_PADDING) / (right - left));
  const x = (container.clientWidth - (right - left) * zoom) / 2 - left * zoom;
  void flow.setViewport({ x, y: NARROW_PADDING - top * zoom, zoom });
}

/** Con el teclado, Enter o espacio sobre un nodo enfocado abre su ficha, como un clic. */
function openFocusedNode(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const node = (e.target as HTMLElement).closest<HTMLElement>('.react-flow__node');
  const id = node?.dataset.id;
  if (!node || !id || e.target !== node) return;
  e.preventDefault();
  showPanel();
  useSelection.getState().select({ kind: node.classList.contains('react-flow__node-location') ? 'location' : 'person', id });
}

export function Canvas() {
  const generation = useDocument((s) => s.generation);
  const narrow = useNarrow();
  return (
    <main id="mapa" className={styles.canvas} aria-label="Mapa de custodia" onKeyDown={openFocusedNode}>
      {/* Cambiar de documento, o girar la pantalla de vertical a horizontal, remonta el lienzo: layout y encuadre desde cero. */}
      <Graph key={`${generation}:${narrow}`} narrow={narrow} />
      <Legend />
      <ScenarioBanner />
    </main>
  );
}

function Graph({ narrow }: { narrow: boolean }) {
  const model = useDocument((s) => s.model);
  const base = useMemo(() => buildGraph(model, narrow ? 'vertical' : 'horizontal'), [model, narrow]);
  const view = useScenarioView();
  const graph = useMemo(() => applyScenario(base, view), [base, view]);
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AccessEdge>(graph.edges);
  const select = useSelection((s) => s.select);
  // En el móvil los nodos no se arrastran: ocupan casi todo el mapa y, arrastrables, se tragan el pellizco (no amplía ni desplaza).
  const container = useRef<HTMLDivElement>(null);

  // Si el modelo cambia, se actualizan los datos pero se respetan las posiciones movidas a mano.
  useEffect(() => {
    setNodes((prev) => {
      const moved = new Map(prev.map((n) => [n.id, n.position]));
      return graph.nodes.map((n) => ({ ...n, position: moved.get(n.id) ?? n.position }));
    });
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

  return (
    <ReactFlow
      ref={container}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      colorMode="dark"
      fitView={!narrow}
      fitViewOptions={{ padding: narrow ? `${NARROW_PADDING}px` : '40px' }}
      onInit={(flow) => {
        if (narrow && container.current) fitWidth(flow, container.current);
      }}
      minZoom={0.2}
      maxZoom={2}
      nodesDraggable={!narrow}
      nodesConnectable={false}
      edgesFocusable={false}
      elementsSelectable={false}
      deleteKeyCode={null}
      onNodeClick={(_, node) => {
        // En pantalla estrecha la ficha está en la otra pestaña: se pasa a ella.
        showPanel();
        select({ kind: node.type === 'location' ? 'location' : 'person', id: node.id });
      }}
      onPaneClick={() => select(null)}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--border-strong)" />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  );
}
