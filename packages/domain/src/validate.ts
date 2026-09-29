import { CustodyModelSchema, type CustodyModel, type Id, type Policy, type SecretRef } from './schema.ts';

export type Severity = 'error' | 'warning';

export type IssueCode =
  | 'schema'
  | 'duplicate-id'
  | 'unknown-reference'
  | 'stateful-holds-nothing'
  | 'threshold-out-of-range'
  | 'key-repeated-in-policy'
  | 'key-not-in-policy'
  | 'no-owner';

/** Problema del modelo. Sin texto localizado: la capa de presentación decide cómo contarlo. */
export interface Issue {
  severity: Severity;
  code: IssueCode;
  path: (string | number)[];
  /** Id implicado, si aplica. */
  ref?: string;
  /** Solo para `schema`: mensaje original del validador. */
  detail?: string;
}

export type ParseResult =
  | { ok: true; model: CustodyModel; warnings: Issue[] }
  | { ok: false; issues: Issue[] };

/** Valida un documento arbitrario (p. ej. JSON importado) y lo normaliza. */
export function parseModel(input: unknown): ParseResult {
  const parsed = CustodyModelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        severity: 'error',
        code: 'schema',
        path: i.path.map((p) => (typeof p === 'symbol' ? String(p) : p)),
        detail: i.message,
      })),
    };
  }
  const issues = checkIntegrity(parsed.data);
  return issues.some((i) => i.severity === 'error')
    ? { ok: false, issues }
    : { ok: true, model: parsed.data, warnings: issues };
}

/** Comprobaciones que el esquema no puede expresar: referencias, coherencia, etc. */
export function checkIntegrity(model: CustodyModel): Issue[] {
  const issues: Issue[] = [];
  const report = (severity: Severity, code: IssueCode, path: (string | number)[], ref?: string) =>
    issues.push(ref === undefined ? { severity, code, path } : { severity, code, path, ref });

  const seen = new Set<Id>();
  for (const collection of ['keys', 'devices', 'artifacts', 'people', 'locations'] as const) {
    model[collection].forEach((entity, i) => {
      if (seen.has(entity.id)) report('error', 'duplicate-id', [collection, i, 'id'], entity.id);
      seen.add(entity.id);
    });
  }

  const keys = new Map(model.keys.map((k) => [k.id, k]));
  const devices = new Map(model.devices.map((d) => [d.id, d]));
  const people = new Set(model.people.map((p) => p.id));
  const locations = new Set(model.locations.map((l) => l.id));

  const ref = (known: { has(id: Id): boolean }, id: Id, path: (string | number)[]) => {
    if (!known.has(id)) report('error', 'unknown-reference', path, id);
  };

  const secret = (s: SecretRef, path: (string | number)[]) => {
    // El PIN de un dispositivo sin PIN o la passphrase de una key sin ella son latentes, no errores.
    switch (s.type) {
      case 'seed':
      case 'xpub':
      case 'passphrase':
        ref(keys, s.key, [...path, 'key']);
        break;
      case 'pin':
        ref(devices, s.device, [...path, 'device']);
        break;
      case 'descriptor':
        break;
    }
  };

  const used: Id[] = [];
  const walk = (p: Policy, path: (string | number)[]) => {
    if (p.type === 'key') {
      ref(keys, p.key, [...path, 'key']);
      if (used.includes(p.key)) report('error', 'key-repeated-in-policy', path, p.key);
      used.push(p.key);
      return;
    }
    if (p.k > p.of.length) report('error', 'threshold-out-of-range', [...path, 'k']);
    p.of.forEach((child, i) => walk(child, [...path, 'of', i]));
  };
  walk(model.policy, ['policy']);
  model.keys.forEach((k, i) => {
    if (!used.includes(k.id)) report('warning', 'key-not-in-policy', ['keys', i], k.id);
  });

  model.devices.forEach((d, i) => {
    ref(locations, d.location, ['devices', i, 'location']);
    d.holds.forEach((k, j) => ref(keys, k, ['devices', i, 'holds', j]));
    if (d.kind === 'stateful' && d.holds.length === 0) report('warning', 'stateful-holds-nothing', ['devices', i, 'holds'], d.id);
  });

  model.artifacts.forEach((a, i) => {
    ref(locations, a.location, ['artifacts', i, 'location']);
    a.contents.forEach((s, j) => secret(s, ['artifacts', i, 'contents', j]));
    a.lockedBy.forEach((s, j) => secret(s, ['artifacts', i, 'lockedBy', j]));
  });

  model.people.forEach((p, i) => p.knows.forEach((s, j) => secret(s, ['people', i, 'knows', j])));

  model.locations.forEach((l, i) =>
    l.access.forEach((a, j) => {
      ref(people, a.person, ['locations', i, 'access', j, 'person']);
      if (a.when.type !== 'always') ref(people, a.when.person, ['locations', i, 'access', j, 'when', 'person']);
    }),
  );

  if (!model.people.some((p) => p.role === 'owner')) report('error', 'no-owner', ['people']);

  return issues;
}
