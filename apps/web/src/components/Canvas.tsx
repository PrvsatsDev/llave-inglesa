import { Background, BackgroundVariant, Controls, ReactFlow, useEdgesState, useNodesState, type NodeTypes } from '@xyflow/react';
import { useEffect, useMemo } from 'react';
import { applyScenario, buildGraph, type AccessEdge, type GraphNode } from '../graph/build.ts';
import { LocationNode } from '../graph/LocationNode.tsx';
import { PersonNode } from '../graph/PersonNode.tsx';
import { useDocument } from '../store/document.ts';
import { useScenarioView } from '../store/scenario.ts';
import { useSelection } from '../store/selection.ts';
import { Legend } from './Legend.tsx';
import { ScenarioBanner } from './ScenarioBanner.tsx';
import { Scoreboard } from './Scoreboard.tsx';
import styles from './Canvas.module.css';

const nodeTypes: NodeTypes = { location: LocationNode, person: PersonNode };

export function Canvas() {
  const generation = useDocument((s) => s.generation);
  return (
    <main className={styles.canvas} aria-label="Mapa de custodia">
      {/* Cambiar de documento remonta el lienzo: layout y encuadre desde cero. */}
      <Graph key={generation} />
      <Scoreboard />
      <Legend />
      <ScenarioBanner />
    </main>
  );
}

function Graph() {
  const model = useDocument((s) => s.model);
  const base = useMemo(() => buildGraph(model), [model]);
  const view = useScenarioView();
  const graph = useMemo(() => applyScenario(base, view), [base, view]);
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AccessEdge>(graph.edges);
  const select = useSelection((s) => s.select);

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
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      colorMode="dark"
      fitView
      // Margen superior extra para que el marcador flotante no tape la fila de ubicaciones.
      fitViewOptions={{ padding: { top: '190px', bottom: '40px', left: '40px', right: '40px' } }}
      minZoom={0.2}
      maxZoom={2}
      nodesConnectable={false}
      edgesFocusable={false}
      elementsSelectable={false}
      deleteKeyCode={null}
      onNodeClick={(_, node) => select({ kind: node.type === 'location' ? 'location' : 'person', id: node.id })}
      onPaneClick={() => select(null)}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--border-strong)" />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  );
}
