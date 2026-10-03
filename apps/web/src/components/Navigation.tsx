import type { CustodyModel, Issue } from '@llave-inglesa/domain';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, FlaskConical, Gauge, LayoutList, XCircle, type LucideIcon } from 'lucide-react';
import { entityName, KIND_LABEL, METRIC_INTRO, METRIC_LABEL, SECTION_INTRO, SECTION_LABEL } from '../lib/sections.ts';
import { useValidation } from '../lib/validation.ts';
import { useLayout } from '../store/layout.ts';
import { goBack, routePosition, useNavigation, type Section } from '../store/navigation.ts';
import { useScenario } from '../store/scenario.ts';
import { useSelection } from '../store/selection.ts';
import { GUIA } from '@llave-inglesa/text';

const GUIDE_INTRO = 'Cómo usar llave-inglesa, paso a paso. Los botones abren ejemplos y simulan en el mapa sin salir de la guía.';
import styles from './Navigation.module.css';

const SECTIONS: { id: Section; icon: LucideIcon }[] = [
  { id: 'schema', icon: LayoutList },
  { id: 'analysis', icon: Gauge },
  { id: 'simulate', icon: FlaskConical },
];

/** Estado de cada pestaña, siempre con icono + texto: errores del esquema, simulación en marcha. */
function TabBadge({ section, issues, simulating }: { section: Section; issues: readonly Issue[]; simulating: boolean }) {
  if (section === 'schema' && issues.length > 0) {
    const errors = issues.filter((i) => i.severity === 'error').length;
    return errors > 0 ? (
      <span className={`${styles.badge} ${styles.error}`} title={`${errors} errores en el modelo`}>
        <XCircle size={12} aria-hidden /> {errors}
      </span>
    ) : (
      <span className={`${styles.badge} ${styles.warning}`} title={`${issues.length} avisos en el modelo`}>
        <AlertTriangle size={12} aria-hidden /> {issues.length}
      </span>
    );
  }
  if (section === 'simulate' && simulating) {
    return (
      <span className={`${styles.badge} ${styles.live}`} title="Hay una simulación en el mapa">
        <span className={styles.liveDot} aria-hidden /> activa
      </span>
    );
  }
  return null;
}

/** Las tres secciones de la columna, y el botón para plegarla. */
export function SectionTabs({ model }: { model: CustodyModel }) {
  const current = useNavigation((s) => s.section);
  const goSection = useNavigation((s) => s.goSection);
  const metric = useNavigation((s) => s.metric);
  const goMetric = useNavigation((s) => s.goMetric);
  const setCollapsed = useLayout((s) => s.setCollapsed);
  const { issues } = useValidation(model);
  const simulating = useScenario((s) => s.active !== null);
  return (
    <nav className={styles.tabsRow} aria-label="Secciones">
      <div className={styles.tabs}>
        {SECTIONS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            className={`${styles.tab} ${current === id ? styles.current : ''}`}
            aria-current={current === id ? 'page' : undefined}
            onClick={() => (id === 'analysis' ? goMetric(metric) : goSection(id))}
          >
            <Icon size={15} aria-hidden />
            {SECTION_LABEL[id]}
            <TabBadge section={id} issues={issues} simulating={simulating} />
          </button>
        ))}
      </div>
      <button className={styles.fold} onClick={() => setCollapsed(true)} aria-label="Plegar el panel" title="Plegar el panel para ver más mapa">
        <ChevronsLeft size={16} />
      </button>
    </nav>
  );
}

interface Crumb {
  label: string;
  onClick?: () => void;
}

/** Dónde estoy: migas de pan con "volver" y, en la raíz de cada sección, qué hay en ella. */
export function Breadcrumbs({ model }: { model: CustodyModel }) {
  const { section, metric, simulatedFrom, routes, simulate, guide, openGuide } = useNavigation();
  const chapter = guide?.chapter ? GUIA.find((c) => c.id === guide.chapter) : undefined;
  const active = useScenario((s) => s.active);
  const trail = useSelection((s) => s.trail);
  const select = useSelection((s) => s.select);
  const backTo = useSelection((s) => s.backTo);

  // Las fichas que ya no existen (eliminadas) desaparecen de las migas.
  const fichas = trail.map((s, i) => ({ s, i, name: entityName(model, s) })).filter((f) => f.name !== null);

  // Recorrer con ‹ › la lista de vías de la que salió la simulación.
  const position = routePosition(routes, active);
  const routeLabel = position >= 0 ? `Vía ${position + 1} de ${routes.length}` : routes.length > 0 ? 'Vía modificada' : 'Simulación';
  const stepper = !guide && section === 'simulate' && simulatedFrom && position >= 0 && routes.length > 1 && fichas.length === 0;
  const goRoute = (i: number) => simulate(routes[i]!, simulatedFrom!, routes);

  const base: Crumb[] = guide
    ? [{ label: 'Guía', onClick: chapter ? () => openGuide(null) : undefined }, ...(chapter ? [{ label: chapter.titulo }] : [])]
    : section === 'analysis'
      ? [{ label: SECTION_LABEL.analysis }, { label: METRIC_LABEL[metric] }]
      : section === 'simulate' && simulatedFrom
        ? [{ label: METRIC_LABEL[simulatedFrom], onClick: goBack }, { label: routeLabel }]
        : [{ label: SECTION_LABEL[section] }];
  if (fichas.length > 0) base.at(-1)!.onClick = () => select(null);
  const crumbs: Crumb[] = [
    ...base,
    ...fichas.map((f, n) => ({
      label: `${KIND_LABEL[f.s.kind]}: ${f.name || 'Sin nombre'}`,
      onClick: n < fichas.length - 1 ? () => backTo(f.i) : undefined,
    })),
  ];
  const canGoBack = fichas.length > 0 || guide !== null || (section === 'simulate' && simulatedFrom !== null);
  const intro = fichas.length > 0 || chapter ? null : guide ? GUIDE_INTRO : section === 'analysis' ? METRIC_INTRO[metric] : section === 'simulate' && simulatedFrom ? null : SECTION_INTRO[section];

  return (
    <div className={styles.crumbsBar}>
      <div className={styles.crumbsRow}>
        {canGoBack && (
          <button className={styles.back} onClick={goBack} title="Volver (Esc)">
            <ArrowLeft size={14} aria-hidden /> Volver
          </button>
        )}
        <ol className={styles.crumbs} aria-label="Estás en">
          {crumbs.map((c, i) => (
            <li key={i} className={styles.crumb}>
              {i > 0 && <ChevronRight size={12} className={styles.sep} aria-hidden />}
              {c.onClick ? (
                <button className={styles.crumbLink} onClick={c.onClick}>
                  {c.label}
                </button>
              ) : (
                <span className={styles.crumbHere} aria-current={i === crumbs.length - 1 ? 'location' : undefined}>
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
        {stepper && (
          <span className={styles.stepper}>
            <button className={styles.step} onClick={() => goRoute(position - 1)} disabled={position === 0} aria-label="Vía anterior" title="Vía anterior">
              <ChevronLeft size={16} />
            </button>
            <button
              className={styles.step}
              onClick={() => goRoute(position + 1)}
              disabled={position === routes.length - 1}
              aria-label="Vía siguiente"
              title="Vía siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </span>
        )}
      </div>
      {intro && <p className={styles.intro}>{intro}</p>}
    </div>
  );
}
