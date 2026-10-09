import type { CustodyModel } from '@llave-inglesa/domain';
import { Monitor } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { UI } from '../lib/text.ts';
import { useDocument } from '../store/document.ts';
import { PANEL_DEFAULT, PANEL_MAX, PANEL_MIN, useLayout } from '../store/layout.ts';
import { useNarrow } from '../store/mobile.ts';
import { useNavigation, type Section as SectionId } from '../store/navigation.ts';
import { useScenarioView } from '../store/scenario.ts';
import { useSelection, type Selection } from '../store/selection.ts';
import { MetricAnalysis } from './Analysis.tsx';
import { TryScenario } from './Findings.tsx';
import { Guide } from './Guide.tsx';
import { Inspector } from './inspector/Inspector.tsx';
import { Breadcrumbs, SectionTabs } from './Navigation.tsx';
import { ScenarioPanel } from './ScenarioPanel.tsx';
import { Schema } from './Schema.tsx';
import { Scoreboard } from './Scoreboard.tsx';
import styles from './Sidebar.module.css';

/**
 * Solo en pantallas de móvil (lo decide el CSS): la herramienta está pensada para pantalla grande.
 * Se puede consultar, pero montar un esquema es más cómodo en un ordenador.
 */
function MobileNotice() {
  const dismissed = useLayout((s) => s.mobileNoticeDismissed);
  const dismiss = useLayout((s) => s.dismissMobileNotice);
  if (dismissed) return null;
  return (
    <div className={styles.mobileNotice} role="note">
      <Monitor size={16} aria-hidden />
      <p>{UI.marco.avisoMovil}</p>
      <button className={styles.mobileNoticeClose} onClick={dismiss}>
        {UI.comun.entendido}
      </button>
    </div>
  );
}

function exists(model: CustodyModel, s: Selection | null): boolean {
  if (!s) return false;
  const lists = { location: model.locations, person: model.people, device: model.devices, artifact: model.artifacts, key: model.keys };
  return lists[s.kind].some((e) => e.id === s.id);
}

/**
 * Columna izquierda: secciones, puntuaciones, migas de pan y el contenido.
 * La ficha de un elemento se abre encima de la sección en la que se estaba, y "volver" regresa a ella.
 */
export function Sidebar() {
  const model = useDocument((s) => s.model);
  const selected = useSelection((s) => s.selected);
  const narrow = useNarrow();
  const collapsed = useLayout((s) => s.collapsed) && !narrow;
  const section = useNavigation((s) => s.section);
  const guide = useNavigation((s) => s.guide);
  const top = useRef<HTMLDivElement>(null);
  // En pantalla estrecha se desplaza el panel entero: al abrir una ficha, un capítulo o una sección
  // estando más abajo, se sube a su principio (justo bajo las notas); si no, se vería a medias.
  useEffect(() => {
    const mark = top.current;
    const panel = mark?.closest('aside');
    if (narrow && mark && panel && mark.getBoundingClientRect().top < panel.getBoundingClientRect().top) mark.scrollIntoView({ block: 'start' });
  }, [narrow, selected, section, guide?.chapter]);
  return (
    <aside className={styles.sidebar} aria-label={UI.marco.panel}>
      <MobileNotice />
      {!collapsed && <SectionTabs model={model} />}
      <Scoreboard />
      {!collapsed && (
        <>
          <div ref={top} />
          <Breadcrumbs model={model} />
          <div className={styles.content}>
            {exists(model, selected) ? <Inspector /> : guide ? <Guide /> : <SectionContent section={section} model={model} />}
          </div>
          <ResizeHandle />
        </>
      )}
    </aside>
  );
}

function SectionContent({ section, model }: { section: SectionId; model: CustodyModel }) {
  const view = useScenarioView();
  const metric = useNavigation((s) => s.metric);
  if (section === 'schema') return <Schema model={model} />;
  if (section === 'simulate') return view ? <ScenarioPanel model={model} view={view} /> : <TryScenario model={model} />;
  return <MetricAnalysis model={model} metric={metric} />;
}

/** Asa para cambiar el ancho de la columna: arrastrar, flechas del teclado o doble clic para el ancho por defecto. */
function ResizeHandle() {
  const width = useLayout((s) => s.width);
  const setWidth = useLayout((s) => s.setWidth);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    const left = handle.parentElement!.getBoundingClientRect().left;
    handle.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setWidth(ev.clientX - left);
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 64 : 16;
    if (e.key === 'ArrowLeft') setWidth(width - step);
    else if (e.key === 'ArrowRight') setWidth(width + step);
    else return;
    e.preventDefault();
  };
  return (
    <div
      className={styles.resize}
      role="separator"
      aria-orientation="vertical"
      aria-label={UI.marco.anchoPanel}
      aria-valuemin={PANEL_MIN}
      aria-valuemax={PANEL_MAX}
      aria-valuenow={width}
      tabIndex={0}
      title={UI.marco.pistaAncho}
      onPointerDown={onPointerDown}
      onDoubleClick={() => setWidth(PANEL_DEFAULT)}
      onKeyDown={onKeyDown}
    />
  );
}
