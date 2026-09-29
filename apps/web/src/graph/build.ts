import { activeHolds, indexModel, isActiveSecret, type Artifact, type CustodyModel, type Device, type Id, type Person, type SecretRef } from '@llave-inglesa/domain';
import type { Edge, Node } from '@xyflow/react';
import { keyColor } from '../lib/key-colors.ts';
import { layoutGraph } from './layout.ts';

/** Vista de un secreto como insignia visual. */
export type SecretBadge =
  | { kind: 'holds' | 'seed' | 'passphrase' | 'xpub'; key: Id; label: string; color: string }
  | { kind: 'pin'; device: Id; label: string }
  | { kind: 'descriptor' };

export type ItemIcon = 'stateful' | 'stateless' | 'paper' | 'metal' | 'washers' | 'digital' | 'other' | 'descriptor';

export type ItemView = {
  kind: 'device' | 'artifact';
  id: Id;
  label: string;
  subtitle: string;
  icon: ItemIcon;
  badges: SecretBadge[];
  pinProtected: boolean;
  registeredWallet: boolean;
  encrypted: boolean;
};

export type KeyTag = { id: Id; label: string; color: string };

export type LocationNodeData = { name: string; items: ItemView[]; keys: KeyTag[] };
export type PersonNodeData = { name: string; role: Person['role']; knows: SecretBadge[] };

export type LocationNode = Node<LocationNodeData, 'location'>;
export type PersonNode = Node<PersonNodeData, 'person'>;
export type GraphNode = LocationNode | PersonNode;
export type AccessEdge = Edge<{ conditional: boolean }>;

export interface Graph {
  nodes: GraphNode[];
  edges: AccessEdge[];
}

const MEDIUM: Record<Artifact['medium'], string> = {
  paper: 'papel',
  metal: 'metal',
  washers: 'arandelas',
  digital: 'digital',
  other: 'otro soporte',
};

export function secretBadge(model: CustodyModel, s: SecretRef, label = indexModel(model).label): SecretBadge {
  switch (s.type) {
    case 'seed':
    case 'passphrase':
    case 'xpub':
      return { kind: s.type, key: s.key, label: label(s.key), color: keyColor(model, s.key) };
    case 'pin':
      return { kind: 'pin', device: s.device, label: label(s.device) };
    case 'descriptor':
      return { kind: 'descriptor' };
  }
}

/** Traduce el modelo de dominio a nodos y aristas de React Flow. Pura y determinista. */
export function buildGraph(model: CustodyModel): Graph {
  const index = indexModel(model);
  const label = (id: Id) => index.label(id);
  const badge = (s: SecretRef) => secretBadge(model, s, label);
  // Las referencias latentes (PIN desactivado, passphrase desactivada) no se dibujan.
  const active = (s: SecretRef) => isActiveSecret(model, s);

  const deviceView = (d: Device): ItemView => ({
    kind: 'device',
    id: d.id,
    label: d.label,
    subtitle: [d.vendor !== d.label ? d.vendor : null, d.kind === 'stateful' ? 'guarda keys' : 'sin estado'].filter(Boolean).join(' · '),
    icon: d.kind,
    badges: activeHolds(d).map((key) => ({ kind: 'holds', key, label: label(key), color: keyColor(model, key) })),
    pinProtected: d.pinProtected,
    registeredWallet: d.kind === 'stateful' && d.registeredWallet,
    encrypted: false,
  });

  const artifactView = (a: Artifact): ItemView => ({
    kind: 'artifact',
    id: a.id,
    label: a.label,
    subtitle: MEDIUM[a.medium],
    icon: a.contents.every((c) => c.type === 'descriptor') ? 'descriptor' : a.medium,
    badges: a.contents.filter(active).map(badge),
    pinProtected: false,
    registeredWallet: false,
    encrypted: a.lockedBy.length > 0,
  });

  const locationData = model.locations.map((l): { id: Id; data: LocationNodeData } => {
    const items = index.itemsAt(l.id).map((i) => (i.kind === 'device' ? deviceView(i.value) : artifactView(i.value)));
    const keyIds = new Set(
      index.itemsAt(l.id).flatMap((i) =>
        i.kind === 'device' ? activeHolds(i.value) : i.value.contents.flatMap((c) => (c.type === 'seed' ? [c.key] : [])),
      ),
    );
    const keys = model.keys.filter((k) => keyIds.has(k.id)).map((k) => ({ id: k.id, label: k.label, color: keyColor(model, k.id) }));
    return { id: l.id, data: { name: l.name, items, keys } };
  });

  const edges: AccessEdge[] = model.locations.flatMap((l) =>
    l.access.map((a): AccessEdge => {
      const base = { id: `access:${a.person}:${l.id}`, source: a.person, target: l.id, sourceHandle: 'top', targetHandle: 'bottom' };
      if (a.when.type === 'always') return { ...base, data: { conditional: false }, className: 'access-always' };
      const text = a.when.type === 'after-death' ? `tras fallecer ${label(a.when.person)}` : `si ${label(a.when.person)} no puede actuar`;
      return { ...base, data: { conditional: true }, label: text, className: 'access-conditional' };
    }),
  );

  const positions = layoutGraph(
    locationData.map((l) => ({ id: l.id, rows: l.data.items.length })),
    model.people.map((p) => ({ id: p.id, rows: p.knows.length, links: edges.filter((e) => e.source === p.id).map((e) => e.target) })),
  );
  const at = (id: Id) => positions.get(id) ?? { x: 0, y: 0 };

  const nodes: GraphNode[] = [
    ...locationData.map((l): LocationNode => ({ id: l.id, type: 'location', position: at(l.id), data: l.data })),
    ...model.people.map((p): PersonNode => ({
      id: p.id,
      type: 'person',
      position: at(p.id),
      data: { name: p.name, role: p.role, knows: p.knows.filter(active).map(badge) },
    })),
  ];

  return { nodes, edges };
}
