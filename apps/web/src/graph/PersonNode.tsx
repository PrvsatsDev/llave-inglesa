import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Brain, Crown, User } from 'lucide-react';
import { UI } from '../lib/text.ts';
import { isSelected, useSelection } from '../store/selection.ts';
import type { PersonNode as PersonNodeType } from './build.ts';
import { PERSON_WIDTH } from './layout.ts';
import { SecretBadge } from './SecretBadge.tsx';
import styles from './nodes.module.css';

export const ROLE = UI.persona.roles;

/** Etiqueta del papel de la persona en el escenario activo. */
const STATE: Partial<Record<NonNullable<PersonNodeType['data']['state']>, string>> = UI.mapa.estados;

export function PersonNode({ id, data }: NodeProps<PersonNodeType>) {
  const selected = useSelection((s) => isSelected(s.selected, 'person', id));
  const Avatar = data.role === 'owner' ? Crown : User;
  const stateTag = data.state && STATE[data.state];
  return (
    <div
      data-state={data.state}
      data-tone={data.tone}
      className={`${styles.person} ${styles[data.role]} ${selected ? styles.selected : ''}`}
      style={{ width: PERSON_WIDTH }}
    >
      <Handle type="source" position={Position.Top} id="top" className={styles.handle} isConnectable={false} />
      {/* En vertical, la persona está a la derecha de las ubicaciones. */}
      <Handle type="source" position={Position.Left} id="left" className={styles.handle} isConnectable={false} />
      <div className={styles.personHeader}>
        <span className={styles.avatar} aria-hidden>
          <Avatar size={15} strokeWidth={2} />
        </span>
        <span className={styles.personText}>
          <span className={styles.personName}>{data.name}</span>
          <span className={styles.role}>{ROLE[data.role]}</span>
        </span>
        {stateTag && <span className={styles.stateTag}>{stateTag}</span>}
      </div>
      {data.knows.length > 0 && (
        <div className={styles.knows}>
          <Brain size={12} className={styles.knowsIcon} aria-label={UI.mapa.sabeDeMemoria} />
          {data.knows.map((b, i) => (
            <SecretBadge key={i} badge={b} withDevice />
          ))}
        </div>
      )}
    </div>
  );
}
