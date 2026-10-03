import { activeHolds, indexModel, isActiveSecret, type Artifact, type CustodyModel, type Device, type Id, type Location, type Person, type SecretRef } from '@llave-inglesa/domain';
import type { DeviceCompromise, Disaster } from '@llave-inglesa/engine';
import type { Edge, MarkerType, Node } from '@xyflow/react';
import { keyColor } from '../lib/key-colors.ts';
import type { ItemState, LocationState, PersonState, ScenarioView } from '../scenario/view.ts';
import { layoutGraph } from './layout.ts';

/** Vista de un secreto como insignia visual. */
export type SecretBadge =
  | { kind: 'holds' | 'seed' | 'passphrase' | 'xpub'; key: Id; label: string; color: string }
  | { kind: 'pin'; device: Id; label: string }
  | { kind: 'password'; artifact: Id; label: string }
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
  /** Estado bajo el escenario activo (ausente si no hay escenario). */
  state?: ItemState;
  /** Si el ataque simulado compromete el dispositivo, cómo. */
  compromise?: DeviceCompromise;
  /** Ha resistido el incendio o la inundación simulados. */
  survived?: boolean;
  /** En una desgracia simulada, lo usa la recuperación: se puede probar qué pasaría si también se perdiera. */
  canLose?: boolean;
};

export type KeyTag = { id: Id; label: string; color: string };
export type Tone = ScenarioView['tone'];

export type LocationNodeData = {
  name: string;
  kind: Location['kind'];
  protection?: Location['protection'];
  /** Nombre de la ubicación que la contiene, si está dentro de otra. */
  insideName?: string;
  items: ItemView[];
  keys: KeyTag[];
  state?: LocationState;
  tone?: Tone;
  /** Desastre simulado aquí, si lo hay. */
  disaster?: Disaster;
};
export type PersonNodeData = { name: string; role: Person['role']; knows: SecretBadge[]; state?: PersonState; tone?: Tone };

export type LocationNode = Node<LocationNodeData, 'location'>;
export type PersonNode = Node<PersonNodeData, 'person'>;
export type GraphNode = LocationNode | PersonNode;
/** Acceso persona→ubicación, o (con `contains`) una ubicación que contiene otra. */
export type AccessEdge = Edge<{ conditional: boolean; contains?: boolean }>;

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
    case 'password':
      return { kind: 'password', artifact: s.artifact, label: label(s.artifact) };
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
    subtitle: a.lockedBy.length > 0 ? `${MEDIUM[a.medium]} · cifrado` : MEDIUM[a.medium],
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
    const insideName = l.inside === undefined ? undefined : index.locations.get(l.inside)?.name;
    return { id: l.id, data: { name: l.name, kind: l.kind, ...(l.protection && { protection: l.protection }), ...(insideName !== undefined && { insideName }), items, keys } };
  });

  const edges: AccessEdge[] = model.locations.flatMap((l) =>
    l.access.map((a): AccessEdge => {
      const base = { id: `access:${a.person}:${l.id}`, source: a.person, target: l.id, sourceHandle: 'top', targetHandle: 'bottom' };
      if (a.when.type === 'always') return { ...base, data: { conditional: false }, className: 'access-always' };
      const text = a.when.type === 'after-death' ? `tras fallecer ${label(a.when.person)}` : `si ${label(a.when.person)} no puede actuar`;
      return { ...base, data: { conditional: true }, label: text, className: 'access-conditional' };
    }),
  );

  // Lo que está dentro de otra ubicación (la caja fuerte de Casa) va justo a su derecha, unido a ella.
  for (const l of model.locations) {
    if (l.inside === undefined || !index.locations.has(l.inside)) continue;
    // La flecha va de lo contenido al continente: "la caja fuerte está en Casa".
    edges.push({
      id: `contains:${l.inside}:${l.id}`,
      source: l.id,
      target: l.inside,
      sourceHandle: 'left',
      targetHandle: 'right',
      type: 'straight',
      markerEnd: { type: 'arrowclosed' as MarkerType, color: 'var(--text-muted)', width: 12, height: 12 },
      data: { conditional: false, contains: true },
      className: 'edge-contains',
    });
  }
  const childrenOf = (id: Id) => locationData.filter((l) => model.locations.find((m) => m.id === l.id)?.inside === id);
  const isChild = (id: Id) => {
    const parent = model.locations.find((m) => m.id === id)?.inside;
    return parent !== undefined && index.locations.has(parent);
  };
  const ordered = locationData.filter((l) => !isChild(l.id)).flatMap((l) => [l, ...childrenOf(l.id)]);

  const positions = layoutGraph(
    ordered.map((l) => ({ id: l.id, rows: l.data.items.length })),
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

/** Superpone un escenario al grafo: estados por elemento y aristas implicadas resaltadas. */
export function applyScenario(graph: Graph, view: ScenarioView | null): Graph {
  if (!view) return graph;
  const { tone } = view;
  const nodes = graph.nodes.map((n): GraphNode => {
    if (n.type === 'location') {
      const items = n.data.items.map((i) => {
        const state = view.items.get(i.id) ?? 'dim';
        const canLose = view.scenario.kind === 'loss' && state === 'used';
        return { ...i, state, compromise: view.compromised.get(i.id), survived: view.survived.has(i.id), canLose };
      });
      return { ...n, data: { ...n.data, items, state: view.locations.get(n.id) ?? 'dim', tone, disaster: view.disasters.get(n.id) } };
    }
    return { ...n, data: { ...n.data, state: view.people.get(n.id) ?? 'dim', tone } };
  });
  const edges = graph.edges.map((e): AccessEdge => {
    if (e.data?.contains) return view.locations.get(e.source) === 'dim' ? { ...e, className: `${e.className ?? ''} edge-dim` } : e;
    const hot = view.edges.has(e.id);
    const state = hot ? `edge-${tone}` : view.reachedEdges.has(e.id) ? `edge-reached edge-reached-${tone}` : 'edge-dim';
    return { ...e, animated: hot, className: `${e.className ?? ''} ${state}` };
  });
  return { nodes, edges };
}
