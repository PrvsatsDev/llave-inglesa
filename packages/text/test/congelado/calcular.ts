/**
 * Red de seguridad de la rama de keys repartidas y Taproot (docs/PLAN-KEYS-REPARTIDAS.md, 2.1): todo lo que la
 * herramienta calcula para un documento, en una forma que se puede comparar byte a byte. Lo guarda una sola vez
 * `scripts/congelar.ts`; `congelado.test.ts` lo recalcula y exige que no cambie nada.
 *
 * Abarca el documento leído (con lo que zod añade por defecto), la integridad, el análisis completo, las
 * explicaciones del «por qué», la carta, las etapas de gasto, la cartera con su descriptor y direcciones, y los
 * textos que salen de todo ello en cada idioma.
 */
import { deriveAddress, formatDescriptor } from '@llave-inglesa/bitcoin';
import { checkIntegrity, indexModel, parseModel, walletDescriptor, walletMiniscript, walletOf, type CustodyModel, type Issue } from '@llave-inglesa/domain';
import {
  analyze,
  attackDerivation,
  createWorld,
  derive,
  explain,
  factId,
  inheritanceLetter,
  legitHoldings,
  simulateInheritance,
  simulateSigning,
  spendStages,
  type Derivation,
  type ExplanationNode,
} from '@llave-inglesa/engine';
import { createHash } from 'node:crypto';
import { TEXTOS, type Idioma } from '../../src/idioma.ts';

const SPEND = factId({ kind: 'spend' });

/** JSON estable: los Map y Set como listas, en su orden de inserción (también forma parte de lo que se congela). */
export function serializar(valor: unknown): string {
  return JSON.stringify(
    valor,
    (_k, v: unknown) => {
      if (v instanceof Map) return { $map: [...v.entries()] };
      if (v instanceof Set) return { $set: [...v] };
      if (v === Number.POSITIVE_INFINITY) return '$infinito';
      if (typeof v === 'function') return undefined;
      return v;
    },
  );
}

/** Huella de una salida serializada (para los modelos aleatorios: así no hace falta guardarla entera). */
export const huella = (s: string) => createHash('sha256').update(s).digest('hex');

const derivacion = (d: Derivation) => ({ facts: d.facts, signable: d.signable, canSpend: d.canSpend, wait: d.wait, why: explain(d, SPEND) });

function textosDelArbol(t: (typeof TEXTOS)[Idioma], node: ExplanationNode | null, model: CustodyModel): string[] {
  if (!node) return [];
  const index = indexModel(model);
  const out: string[] = [];
  const walk = (n: ExplanationNode, depth: number) => {
    out.push(`${'  '.repeat(depth)}${t.factText(n.fact, index)} ← ${t.ruleText(n.justification, index, model.policy)}${n.repeated ? ' (repetido)' : ''}`);
    n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(node, 0);
  return out;
}

function calcularModelo(model: CustodyModel, issues: readonly Issue[]) {
  const a = analyze(model);
  const world = createWorld(model);
  const legit = legitHoldings(world);
  const letter = inheritanceLetter(model, a.inheritance);
  const stages = spendStages(model.policy);
  const wallet = walletDescriptor(model);
  const firmar = derivacion(simulateSigning(model));
  const heredar = derivacion(simulateInheritance(model));
  const seguro = derivacion(derive(world, legit, 'secure'));
  const cualquiera = derivacion(derive(world, legit, 'any'));
  const robos = a.security.cheapest.map((cut) => derivacion(attackDerivation(world, cut)));
  const cartera = wallet.ok
    ? {
        ...wallet,
        texto: formatDescriptor(wallet.descriptor),
        recibir: deriveAddress(wallet.descriptor, wallet.network, 0, 0),
        cambio: deriveAddress(wallet.descriptor, wallet.network, 1, 0),
      }
    : wallet;

  const textos = Object.fromEntries(
    (Object.keys(TEXTOS) as Idioma[]).map((idioma) => {
      const t = TEXTOS[idioma];
      const index = indexModel(model);
      const label = index.label;
      return [
        idioma,
        {
          issues: issues.map((i) => t.issueText(i, label)),
          policy: t.policyText(model.policy, label),
          stages: stages?.map((s) => t.spendStageText(s, label)) ?? null,
          robos: a.security.cuts.map((cut) => cut.map((atom) => t.attackText(atom, index))),
          perdidas: [...a.resilience.cuts, ...a.resilience.lockouts, ...a.resilience.delays].map((cut) => cut.map((e) => t.lossText(e, index))),
          herencia: t.inheritanceText(a.inheritance, model.people),
          coaccion: a.duress.map((r) => t.duressText(r, a.security, index)),
          cartera: wallet.ok ? wallet.warnings.map((w) => t.walletWarningText(w, label)) : wallet.problems.map((p) => t.walletProblemText(p, label)),
          carta: {
            saludo: t.letterGreeting(letter, label),
            cuando: t.letterWhen(letter, label),
            que: t.letterWhatThereIs(model),
            ayuda: t.letterHelpers(letter, label),
            espera: t.letterWaitNote(letter),
            piezas: letter.stops.map((s) => s.pieces.map((p) => t.letterPieceText(p, label))),
            memoria: letter.memory.map((m) => t.letterMemoryText(m, label)),
            pasos: t.letterSteps(model, letter),
          },
          porque: {
            firmar: textosDelArbol(t, firmar.why, model),
            heredar: textosDelArbol(t, heredar.why, model),
            robos: robos.map((r) => textosDelArbol(t, r.why, model)),
          },
        },
      ];
    }),
  );

  return {
    integrity: checkIntegrity(model),
    analysis: a,
    letter,
    stages,
    wallet: { of: walletOf(model), miniscript: walletMiniscript(model), descriptor: cartera },
    derivations: { firmar, heredar, seguro, cualquiera, robos },
    textos,
  };
}

/** Todo lo que se calcula para un documento tal como llega (JSON sin leer). */
export function calcular(documento: unknown) {
  const parsed = parseModel(documento);
  if (!parsed.ok) return { parsed };
  return { parsed, ...calcularModelo(parsed.model, parsed.warnings) };
}
