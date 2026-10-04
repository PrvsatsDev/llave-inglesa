import { LayoutList, Map as MapIcon, type LucideIcon } from 'lucide-react';
import { useMobile, type MobileView } from '../store/mobile.ts';
import styles from './MobileTabs.module.css';

const TABS: { id: MobileView; label: string; icon: LucideIcon }[] = [
  { id: 'panel', label: 'Panel', icon: LayoutList },
  { id: 'map', label: 'Mapa', icon: MapIcon },
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
    <nav className={styles.bar} aria-label="Panel o mapa">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button key={id} className={`${styles.tab} ${view === id ? styles.current : ''}`} aria-current={view === id ? 'page' : undefined} onClick={() => show(id)}>
          <Icon size={18} aria-hidden />
          {label}
          {id === 'map' && mapChanged && (
            <span className={styles.badge} title="El mapa ha cambiado desde la última vez que lo viste">
              <span className={styles.dot} aria-hidden /> nuevo
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
