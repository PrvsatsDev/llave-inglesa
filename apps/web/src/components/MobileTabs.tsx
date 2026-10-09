import { LayoutList, Map as MapIcon, type LucideIcon } from 'lucide-react';
import { UI } from '../lib/text.ts';
import { useMobile, type MobileView } from '../store/mobile.ts';
import styles from './MobileTabs.module.css';

const T = UI.marco.pestanas;

const TABS: { id: MobileView; texto: 'panel' | 'mapa'; icon: LucideIcon }[] = [
  { id: 'panel', texto: 'panel', icon: LayoutList },
  { id: 'map', texto: 'mapa', icon: MapIcon },
];

/**
 * Pestañas Panel / Mapa, abajo y al alcance del pulgar. Solo en pantalla estrecha (lo decide el CSS).
 * Si el mapa cambia mientras se mira el panel, su pestaña lo avisa con «nuevo», pero no salta sola.
 */
export function MobileTabs() {
  const view = useMobile((s) => s.view);
  const mapChanged = useMobile((s) => s.mapChanged);
  const show = useMobile((s) => s.show);
  return (
    <nav className={styles.bar} aria-label={T.nombre}>
      {TABS.map(({ id, texto, icon: Icon }) => (
        <button key={id} className={`${styles.tab} ${view === id ? styles.current : ''}`} aria-current={view === id ? 'page' : undefined} onClick={() => show(id)}>
          <Icon size={18} aria-hidden />
          {T[texto]}
          {id === 'map' && mapChanged && (
            <span className={styles.badge} title={T.pistaNuevo}>
              <span className={styles.dot} aria-hidden /> {T.nuevo}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
