import { indexModel, type CustodyModel, type Issue, type ModelIndex } from '@llave-inglesa/domain';
import type { AttackAtom, ExplanationNode, LossEvent } from '@llave-inglesa/engine';
import { attackText, factText, lossText, policyText, ruleText } from '@llave-inglesa/text';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
export const bold = paint(1);
export const dim = paint(2);
export const red = paint(31);
export const green = paint(32);
export const yellow = paint(33);

/** Presentación en terminal. Los textos salen de @llave-inglesa/text. */
export class Formatter {
  private readonly index: ModelIndex;

  constructor(readonly model: CustodyModel) {
    this.index = indexModel(model);
  }

  policy(): string {
    return policyText(this.model.policy, this.index.label);
  }

  attack(a: AttackAtom): string {
    return attackText(a, this.index.label);
  }

  loss(e: LossEvent): string {
    return lossText(e, this.index.label);
  }

  tree(node: ExplanationNode, prefix = '', last = true, root = true): string[] {
    const connector = root ? '' : last ? '└─ ' : '├─ ';
    const text = factText(node.fact, this.index);
    const label = node.fact.kind === 'spend' ? bold(text.toUpperCase()) : text;
    const reason = ruleText(node.justification, this.index, this.model.policy);
    const why = node.repeated ? dim('  (ver arriba)') : reason ? dim(`  ← ${reason}`) : '';
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
