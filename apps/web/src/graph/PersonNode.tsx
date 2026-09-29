import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Brain, Crown, User } from 'lucide-react';
import type { PersonNode as PersonNodeType } from './build.ts';
import { PERSON_WIDTH } from './layout.ts';
import { SecretBadge } from './SecretBadge.tsx';
import styles from './nodes.module.css';

const ROLE = {
  owner: 'Titular',
  heir: 'Heredero/a',
  custodian: 'Custodio/a',
  other: 'Otra persona',
} as const;

export function PersonNode({ data, selected }: NodeProps<PersonNodeType>) {
  const Avatar = data.role === 'owner' ? Crown : User;
  return (
    <div className={`${styles.person} ${styles[data.role]} ${selected ? styles.selected : ''}`} style={{ width: PERSON_WIDTH }}>
      <Handle type="source" position={Position.Top} id="top" className={styles.handle} isConnectable={false} />
      <div className={styles.personHeader}>
        <span className={styles.avatar} aria-hidden>
          <Avatar size={15} strokeWidth={2} />
        </span>
        <span className={styles.personText}>
          <span className={styles.personName}>{data.name}</span>
          <span className={styles.role}>{ROLE[data.role]}</span>
        </span>
      </div>
      {data.knows.length > 0 && (
        <div className={styles.knows}>
          <Brain size={12} className={styles.knowsIcon} aria-label="Sabe de memoria" />
          {data.knows.map((b, i) => (
            <SecretBadge key={i} badge={b} withDevice />
          ))}
        </div>
      )}
    </div>
  );
}
