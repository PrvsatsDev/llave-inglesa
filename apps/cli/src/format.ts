import { indexModel, type CustodyModel, type Issue, type ModelIndex, type Policy, type SecretRef } from '@llave-inglesa/domain';
import type { AttackAtom, EntropyOrigin, ExplanationNode, Fact, Justification, LossEvent } from '@llave-inglesa/engine';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
export const bold = paint(1);
export const dim = paint(2);
export const red = paint(31);
export const green = paint(32);
export const yellow = paint(33);

/** Textos en español para todo lo que produce el motor. */
export class Formatter {
  private readonly index: ModelIndex;

  constructor(readonly model: CustodyModel) {
    this.index = indexModel(model);
  }

  private name = (id: string) => this.index.label(id);

  policy(p: Policy = this.model.policy): string {
    if (p.type === 'key') return this.name(p.key);
    return `${p.k} de ${p.of.length} (${p.of.map((c) => this.policy(c)).join(', ')})`;
  }

  origin(o: EntropyOrigin): string {
    return o.kind === 'unknown' ? 'origen desconocido' : o.vendor;
  }

  attack(a: AttackAtom): string {
    switch (a.type) {
      case 'burglary':
        return `Intrusión en ${this.name(a.location)} sin nadie presente`;
      case 'coercion':
        return a.location
          ? `Llave inglesa: coacción a ${this.name(a.person)} en ${this.name(a.location)}`
          : `Llave inglesa: coacción a ${this.name(a.person)}`;
      case 'insider':
        return `Traición de ${this.name(a.person)}`;
      case 'entropy-compromise':
        return `RNG comprometido: ${this.origin(a.origin)}`;
    }
  }

  loss(e: LossEvent): string {
    switch (e.type) {
      case 'destroy-location': return `Destrucción de ${this.name(e.location)} (incendio, inundación…)`;
      case 'item-loss': return `Pérdida o avería de ${this.name(e.item)}`;
      case 'death': return `Fallecimiento de ${this.name(e.person)}`;
      case 'incapacity': return `Incapacidad de ${this.name(e.person)}`;
      case 'forget': return `${this.name(e.person)} olvida lo que tenía memorizado`;
    }
  }

  secret(s: SecretRef): string {
    switch (s.type) {
      case 'seed': return `semilla de ${this.name(s.key)}`;
      case 'passphrase': return `passphrase de ${this.name(s.key)}`;
      case 'xpub': return `xpub de ${this.name(s.key)}`;
      case 'pin': return `PIN de ${this.name(s.device)}`;
      case 'descriptor': return 'descriptor del wallet';
    }
  }

  fact(f: Fact): string {
    switch (f.kind) {
      case 'item': {
        const item = this.index.items.get(f.item);
        return item ? `${item.value.label} (${this.name(item.value.location)})` : f.item;
      }
      case 'secret': return this.secret(f.secret);
      case 'unlocked': return `${this.name(f.device)} desbloqueado`;
      case 'sign': return `firma con ${this.name(f.key)}`;
      case 'spend': return 'PUEDE GASTAR LOS FONDOS';
    }
  }

  rule(j: Justification): string {
    const v = j.via ?? {};
    switch (j.rule) {
      case 'location-access': return `al alcance en ${this.name(v.location ?? '?')}`;
      case 'memory': return `lo sabe ${this.name(v.person ?? '?')}`;
      case 'entropy-compromise': return `predecible: RNG de ${(v.origins ?? []).map((o) => this.origin(o)).join(' + ')}`;
      case 'read-artifact': return 'escrito ahí';
      case 'descriptor-xpubs': return 'incluida en el descriptor';
      case 'unlock-device': return 'desbloqueado';
      case 'device-sign': return 'firma el dispositivo';
      case 'device-xpub': return 'la exporta el dispositivo';
      case 'device-wallet': return `multisig registrado en ${this.name(v.device ?? '?')}`;
      case 'seed-xpub': return 'derivada de la semilla';
      case 'seed-sign': return 'tecleando la semilla en cualquier software';
      case 'seed-sign-on-device': return `cargando la semilla en ${this.name(v.device ?? '?')}`;
      case 'spend': return `política ${this.policy()} satisfecha`;
    }
  }

  tree(node: ExplanationNode, prefix = '', last = true, root = true): string[] {
    const connector = root ? '' : last ? '└─ ' : '├─ ';
    const label = node.fact.kind === 'spend' ? bold(this.fact(node.fact)) : this.fact(node.fact);
    const why = node.repeated ? dim('  (ver arriba)') : node.justification.rule === 'unlock-device' ? '' : dim(`  ← ${this.rule(node.justification)}`);
    const lines = [`${prefix}${connector}${label}${why}`];
    const childPrefix = root ? prefix : prefix + (last ? '   ' : '│  ');
    node.children.forEach((child, i) => lines.push(...this.tree(child, childPrefix, i === node.children.length - 1, false)));
    return lines;
  }

}

export function formatIssue(i: Issue): string {
  const where = i.path.join('.');
  const ref = i.ref ? ` "${i.ref}"` : '';
  const text: Record<Issue['code'], string> = {
    'schema': `formato inválido: ${i.detail ?? ''}`,
    'duplicate-id': `id repetido${ref}`,
    'unknown-reference': `referencia a algo que no existe${ref}`,
    'stateful-holds-nothing': `dispositivo stateful sin ninguna key dentro${ref}`,
    'threshold-out-of-range': 'el umbral es mayor que el número de opciones',
    'key-repeated-in-policy': `key repetida en la política${ref}`,
    'key-not-in-policy': `key que no participa en la política${ref}`,
    'no-owner': 'no hay ninguna persona con rol de titular',
  };
  const tag = i.severity === 'error' ? red('error') : yellow('aviso');
  return `${tag} ${dim(where)} ${text[i.code]}`;
}

export function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  const color = score >= 75 ? green : score >= 50 ? yellow : red;
  return `${color(bar)} ${String(score).padStart(3)}`;
}
