import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Bug,
  Camera,
  Circle,
  Cloud,
  Cpu,
  FileCode2,
  FileText,
  HardDrive,
  Laptop,
  Lock,
  LockKeyhole,
  MapPin,
  Network,
  Package,
  RectangleHorizontal,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { isSelected, useSelection } from '../store/selection.ts';
import type { ItemIcon, ItemView, LocationNode as LocationNodeType } from './build.ts';
import { LOCATION_WIDTH } from './layout.ts';
import { SecretBadge } from './SecretBadge.tsx';
import styles from './nodes.module.css';

export const ITEM_ICONS: Record<ItemIcon, LucideIcon> = {
  stateful: Cpu,
  stateless: Camera,
  paper: FileText,
  metal: RectangleHorizontal,
  washers: Circle,
  digital: HardDrive,
  other: Package,
  descriptor: FileCode2,
};

/** Etiqueta del desastre simulado en la ubicación ('total' según el tipo de ubicación). */
const DISASTER_TAG = { fire: 'Incendio', flood: 'Inundación', physical: 'Sin acceso', device: 'Averiado', cloud: 'Cuenta perdida' } as const;

/** Cómo cae el dispositivo en el ataque simulado (texto además del color). */
const COMPROMISE = { firmware: 'Firmware malicioso', extraction: 'Semilla extraída' } as const;

function ItemRow({ item }: { item: ItemView }) {
  const Icon = ITEM_ICONS[item.icon];
  const isDevice = item.icon === 'stateful' || item.icon === 'stateless';
  const selected = useSelection((s) => isSelected(s.selected, item.kind, item.id));
  const select = useSelection((s) => s.select);
  return (
    <li
      data-state={item.state}
      data-compromised={item.compromise}
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
          {item.encrypted && <LockKeyhole size={11} className={styles.inlineIcon} aria-label="cifrado" />}
        </span>
        {item.survived && (
          <span className={styles.survivedTag}>
            <ShieldCheck size={11} aria-hidden /> Resiste
          </span>
        )}
        {item.compromise && (
          <span className={styles.compromiseTag}>
            <Bug size={11} aria-hidden /> {COMPROMISE[item.compromise]}
          </span>
        )}
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

export const LOCATION_ICONS: Record<LocationNodeType['data']['kind'], LucideIcon> = { physical: MapPin, device: Laptop, cloud: Cloud };

export function LocationNode({ id, data }: NodeProps<LocationNodeType>) {
  const LocationIcon = LOCATION_ICONS[data.kind];
  const selected = useSelection((s) => isSelected(s.selected, 'location', id));
  return (
    <div
      data-state={data.state}
      data-tone={data.tone}
      className={`${styles.location} ${selected ? styles.selected : ''}`}
      style={{ width: LOCATION_WIDTH }}
    >
      <header className={styles.locationHeader}>
        <LocationIcon size={14} className={styles.locationPin} aria-hidden />
        <span className={styles.locationName}>{data.name}</span>
        {data.disaster && <span className={styles.stateTag}>{DISASTER_TAG[data.disaster === 'total' ? data.kind : data.disaster]}</span>}
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
