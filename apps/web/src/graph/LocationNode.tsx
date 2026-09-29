import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Camera,
  Circle,
  Cpu,
  FileCode2,
  FileText,
  HardDrive,
  Lock,
  MapPin,
  Network,
  Package,
  RectangleHorizontal,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { isSelected, useSelection } from '../store/selection.ts';
import type { ItemIcon, ItemView, LocationNode as LocationNodeType } from './build.ts';
import { LOCATION_WIDTH } from './layout.ts';
import { SecretBadge } from './SecretBadge.tsx';
import styles from './nodes.module.css';

const ICONS: Record<ItemIcon, LucideIcon> = {
  stateful: Cpu,
  stateless: Camera,
  paper: FileText,
  metal: RectangleHorizontal,
  washers: Circle,
  digital: HardDrive,
  other: Package,
  descriptor: FileCode2,
};

function ItemRow({ item }: { item: ItemView }) {
  const Icon = ICONS[item.icon];
  const isDevice = item.icon === 'stateful' || item.icon === 'stateless';
  const selected = useSelection((s) => isSelected(s.selected, item.kind, item.id));
  const select = useSelection((s) => s.select);
  return (
    <li
      className={`${styles.item} ${selected ? styles.itemSelected : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: item.kind, id: item.id });
      }}
    >
      <span className={`${styles.itemIcon} ${isDevice ? styles.deviceIcon : ''}`} aria-hidden>
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <span className={styles.itemText}>
        <span className={styles.itemLabel}>
          {item.label}
          {item.pinProtected && <Lock size={11} className={styles.inlineIcon} aria-label="con PIN" />}
          {item.encrypted && <ShieldAlert size={11} className={styles.inlineIcon} aria-label="cifrado" />}
        </span>
        <span className={styles.itemSubtitle}>
          {item.subtitle}
          {item.registeredWallet && (
            <>
              {' · '}
              <Network size={10} className={styles.inlineIcon} aria-hidden /> multisig
            </>
          )}
        </span>
      </span>
      <span className={styles.badges}>
        {item.badges.map((b, i) => (
          <SecretBadge key={i} badge={b} />
        ))}
      </span>
    </li>
  );
}

export function LocationNode({ id, data }: NodeProps<LocationNodeType>) {
  const selected = useSelection((s) => isSelected(s.selected, 'location', id));
  return (
    <div className={`${styles.location} ${selected ? styles.selected : ''}`} style={{ width: LOCATION_WIDTH }}>
      <header className={styles.locationHeader}>
        <MapPin size={14} className={styles.locationPin} aria-hidden />
        <span className={styles.locationName}>{data.name}</span>
        <span className={styles.keyTags} aria-label="Keys materializadas aquí">
          {data.keys.map((k) => (
            <span key={k.id} className={styles.keyTag} style={{ '--key-color': k.color } as CSSProperties} title={`${k.label} está aquí`}>
              {k.label}
            </span>
          ))}
        </span>
      </header>
      {data.items.length > 0 ? (
        <ul className={styles.items}>
          {data.items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className={styles.emptyLocation}>Vacía</p>
      )}
      <Handle type="target" position={Position.Bottom} id="bottom" className={styles.handle} isConnectable={false} />
    </div>
  );
}
