import { Background, BackgroundVariant, Controls, ReactFlow, useEdgesState, useNodesState, type NodeTypes } from '@xyflow/react';
import { useEffect, useMemo } from 'react';
import { buildGraph, type AccessEdge, type GraphNode } from '../graph/build.ts';
import { LocationNode } from '../graph/LocationNode.tsx';
import { PersonNode } from '../graph/PersonNode.tsx';
import { useDocument } from '../store/document.ts';
import { Legend } from './Legend.tsx';
import styles from './Canvas.module.css';

const nodeTypes: NodeTypes = { location: LocationNode, person: PersonNode };

export function Canvas() {
  const origin = useDocument((s) => s.origin);
  return (
    <main className={styles.canvas} aria-label="Mapa de custodia">
      {/* Cambiar de documento remonta el lienzo: layout y encuadre desde cero. */}
      <Graph key={origin.id} />
      <Legend />
    </main>
  );
}

function Graph() {
  const model = useDocument((s) => s.model);
  const graph = useMemo(() => buildGraph(model), [model]);
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AccessEdge>(graph.edges);

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
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.2}
      maxZoom={2}
      nodesConnectable={false}
      edgesFocusable={false}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--border-strong)" />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  );
}
