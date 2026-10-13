import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  CircleSlash,
  Bug,
  Camera,
  Circle,
  Cloud,
  Cpu,
  FileCode2,
  FileText,
  HardDrive,
  Landmark,
  Laptop,
  Lock,
  LockKeyhole,
  MapPin,
  Monitor,
  Network,
  Package,
  RectangleHorizontal,
  ShieldCheck,
  Smartphone,
  Vault,
  Hourglass,
  type LucideIcon,
} from 'lucide-react';
import { moveItem } from '@llave-inglesa/domain';
import { useState, type CSSProperties } from 'react';
import { UI, waitText } from '../lib/text.ts';
import { useScenario } from '../store/scenario.ts';
import { isSelected, useSelection } from '../store/selection.ts';
import { useDocument } from '../store/document.ts';
import { showPanel, useNarrow } from '../store/mobile.ts';
import type { ItemIcon, ItemView, LocationNode as LocationNodeType } from './build.ts';
import { LOCATION_WIDTH } from './layout.ts';
import { SecretBadge } from './SecretBadge.tsx';
import styles from './nodes.module.css';

const T = UI.mapa;

export const ITEM_ICONS: Record<ItemIcon, LucideIcon> = {
  stateful: Cpu,
  stateless: Camera,
  paper: FileText,
  metal: RectangleHorizontal,
  washers: Circle,
  digital: HardDrive,
  other: Package,
  descriptor: FileCode2,
  computer: Monitor,
  phone: Smartphone,
};

/** Etiqueta del desastre simulado en la ubicación ('total' según el tipo de ubicación). */
const DISASTER_TAG = T.desastres;

/** Ubicación que hace falta en la simulación (texto además del color). */
const USED_TAG = T.usada;

/** Cómo cae el dispositivo en el ataque simulado (texto además del color). */
const COMPROMISE = T.comprometido;

/** Añade la pérdida de un objeto a la desgracia que se está simulando. */
function addLoss(item: string) {
  const { active, set } = useScenario.getState();
  if (active?.kind !== 'loss' || active.events.some((e) => e.type === 'item-loss' && e.item === item)) return;
  set({ kind: 'loss', events: [...active.events, { type: 'item-loss', item }] });
}

/**
 * Lo que se está arrastrando en el mapa (solo en escritorio): qué objeto y desde qué ubicación. Se guarda aquí y no en
 * el dataTransfer, para saber al pasar por encima si es otra ubicación y no leer nunca datos de fuera de la app.
 */
let dragging: { item: Pick<ItemView, 'kind' | 'id'>; from: string } | null = null;
const DRAG_TYPE = 'application/x-llave-inglesa-item';

export function ItemRow({ item, location }: { item: ItemView; location: string | null }) {
  const Icon = ITEM_ICONS[item.icon];
  const isDevice = item.icon === 'stateful' || item.icon === 'stateless';
  const selected = useSelection((s) => isSelected(s.selected, item.kind, item.id));
  const select = useSelection((s) => s.select);
  // Lo que lleva encima una persona no se arrastra: se cambia de sitio desde su ficha.
  const draggable = !useNarrow() && location !== null;
  return (
    <li
      data-state={item.state}
      data-compromised={item.compromise}
      // nodrag: arrastrar la fila mueve el objeto, no la ubicación entera (esa se arrastra por su cabecera).
      className={`${styles.item} ${selected ? styles.itemSelected : ''} ${draggable ? `nodrag ${styles.draggable}` : ''}`}
      draggable={draggable}
      title={draggable ? T.pistaArrastrar : undefined}
      onDragStart={(e) => {
        if (location === null) return;
        dragging = { item: { kind: item.kind, id: item.id }, from: location };
        e.dataTransfer.setData(DRAG_TYPE, item.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => {
        dragging = null;
      }}
      onClick={(e) => {
        e.stopPropagation();
        showPanel();
        select({ kind: item.kind, id: item.id });
      }}
    >
      <span className={`${styles.itemIcon} ${isDevice ? styles.deviceIcon : ''}`} aria-hidden>
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <span className={styles.itemText}>
        <span className={styles.itemLabel}>
          {item.label}
          {item.pinProtected && <Lock size={11} className={styles.inlineIcon} aria-label={T.conPin} />}
          {item.encrypted && <LockKeyhole size={11} className={styles.inlineIcon} aria-label={T.cifradoAccesible} />}
        </span>
        {(item.survived || item.canLose) && (
          <span className={styles.itemTags}>
            {item.survived && (
              <span className={styles.survivedTag}>
                <ShieldCheck size={11} aria-hidden /> {T.resiste}
              </span>
            )}
            {item.canLose && (
              <button
                className={`${styles.whatIf} nodrag`}
                onClick={(e) => {
                  e.stopPropagation();
                  addLoss(item.id);
                }}
                title={T.pistaPerdida}
              >
                <CircleSlash size={11} aria-hidden /> {item.survived ? T.ySiNoResiste : T.ySiSePierde}
              </button>
            )}
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
              <Network size={10} className={styles.inlineIcon} aria-hidden /> {T.multisig}
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
const PROTECTION_ICONS: Record<NonNullable<LocationNodeType['data']['protection']>, LucideIcon> = { 'home-safe': Vault, 'bank-box': Landmark };
export const PROTECTION_TEXT = UI.ubicacion.protecciones;

/** Icono de una ubicación: el de su protección o, si no tiene, el de su tipo. */
export function locationIcon(data: Pick<LocationNodeType['data'], 'kind' | 'protection'>): LucideIcon {
  return data.protection ? PROTECTION_ICONS[data.protection] : LOCATION_ICONS[data.kind];
}

/** "Caja fuerte · dentro de Casa", o null si no tiene protección ni está dentro de otra. */
export function locationMeta(data: Pick<LocationNodeType['data'], 'protection' | 'insideName'>): string | null {
  const parts = [data.protection && PROTECTION_TEXT[data.protection], data.insideName !== undefined && T.dentroDe(data.insideName)].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function LocationNode({ id, data }: NodeProps<LocationNodeType>) {
  const LocationIcon = locationIcon(data);
  const meta = locationMeta(data);
  const selected = useSelection((s) => isSelected(s.selected, 'location', id));
  const apply = useDocument((s) => s.apply);
  /** Se está arrastrando encima un objeto de otra ubicación. */
  const [dropTarget, setDropTarget] = useState(false);
  return (
    <div
      data-state={data.state}
      data-tone={data.tone}
      className={`${styles.location} ${selected ? styles.selected : ''} ${dropTarget ? styles.dropTarget : ''}`}
      style={{ width: LOCATION_WIDTH }}
      onDragOver={(e) => {
        if (!dragging || dragging.from === id) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTarget(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(false);
      }}
      onDrop={(e) => {
        setDropTarget(false);
        if (!dragging || dragging.from === id) return;
        e.preventDefault();
        const { item } = dragging;
        dragging = null;
        apply((m) => moveItem(m, item, id));
      }}
    >
      <header className={styles.locationHeader}>
        <LocationIcon size={14} className={styles.locationPin} aria-hidden />
        <span className={styles.locationTitle}>
          <span className={styles.locationName}>{data.name}</span>
          {meta && <span className={styles.locationMeta}>{meta}</span>}
          {(data.disaster || data.state === 'used' || data.state === 'reached' || dropTarget) && (
            <span className={styles.locationTags}>
              {dropTarget && <span className={`${styles.stateTag} ${styles.dropTag}`}>{T.soltarAqui}</span>}
              {data.disaster && <span className={styles.stateTag}>{DISASTER_TAG[data.disaster === 'total' ? data.kind : data.disaster]}</span>}
              {data.state === 'used' && <span className={styles.stateTag}>{USED_TAG[data.tone ?? 'recovery']}</span>}
              {data.state === 'reached' && <span className={`${styles.stateTag} ${styles.reachedTag}`}>{T.alAlcance}</span>}
            </span>
          )}
        </span>
        <span className={styles.keyTags} aria-label={T.keysAqui}>
          {data.keys.map((k) => (
            <span
              key={k.id}
              className={styles.keyTag}
              style={{ '--key-color': k.color } as CSSProperties}
              title={k.wait ? `${T.keyAqui(k.label)}. ${T.soloTrasEsperar(waitText(k.wait))}` : T.keyAqui(k.label)}
            >
              {k.label}
              {k.wait && (
                <span className={styles.keyWait}>
                  <Hourglass size={10} aria-hidden />
                  {waitText(k.wait)}
                </span>
              )}
            </span>
          ))}
        </span>
      </header>
      {data.items.length > 0 ? (
        <ul className={styles.items}>
          {data.items.map((item) => (
            <ItemRow key={item.id} item={item} location={id} />
          ))}
        </ul>
      ) : (
        <p className={styles.emptyLocation}>{UI.esquema.vacia}</p>
      )}
      <Handle type="target" position={Position.Bottom} id="bottom" className={styles.handle} isConnectable={false} />
      {/* En vertical, lo contenido va debajo de su continente: la flecha sale de arriba. */}
      <Handle type="source" position={Position.Top} id="top" className={styles.handle} isConnectable={false} />
      {/* A la altura de la cabecera: la flecha sale de lo contenido (izquierda) y llega al continente (derecha). En vertical, a la
          derecha llegan también los accesos de las personas. */}
      <Handle type="source" position={Position.Left} id="left" className={`${styles.handle} ${styles.sideHandle}`} isConnectable={false} />
      <Handle type="target" position={Position.Right} id="right" className={`${styles.handle} ${styles.sideHandle}`} isConnectable={false} />
    </div>
  );
}
