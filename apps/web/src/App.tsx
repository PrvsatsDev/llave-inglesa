import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './components/Canvas.tsx';
import { Header } from './components/Header.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import styles from './App.module.css';

export function App() {
  return (
    <ReactFlowProvider>
      <div className={styles.shell}>
        <Header />
        <Canvas />
        <Sidebar />
      </div>
    </ReactFlowProvider>
  );
}
