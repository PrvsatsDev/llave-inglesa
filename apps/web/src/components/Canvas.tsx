import { Background, BackgroundVariant, Controls, ReactFlow } from '@xyflow/react';
import { Map as MapIcon } from 'lucide-react';
import styles from './Canvas.module.css';

/** Lienzo del mapa de custodia. Los nodos llegan en el paso 2. */
export function Canvas() {
  return (
    <main className={styles.canvas} aria-label="Mapa de custodia">
      <ReactFlow nodes={[]} edges={[]} colorMode="dark" fitView proOptions={{ hideAttribution: false }}>
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--border-strong)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
      <div className={styles.empty}>
        <MapIcon size={28} strokeWidth={1.5} />
        <p>Aquí se dibujará el mapa de tu custodia</p>
        <span>ubicaciones · dispositivos · backups · personas</span>
      </div>
    </main>
  );
}
