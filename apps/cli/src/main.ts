#!/usr/bin/env -S npx tsx
import { readFile } from 'node:fs/promises';
import { parseModel, type CustodyModel } from '@llave-inglesa/domain';
import { analyze, explain, simulateAttack, simulateLosses, type Analysis } from '@llave-inglesa/engine';
import { bold, dim, formatIssue, Formatter, green, red, scoreBar } from './format.ts';

const USAGE = 'Uso: llave-inglesa analyze <modelo.json>';

async function main(argv: string[]): Promise<number> {
  const [command, file] = argv;
  if (command !== 'analyze' || !file) {
    console.error(USAGE);
    return 2;
  }

  const result = parseModel(JSON.parse(await readFile(file, 'utf8')));
  if (!result.ok) {
    console.error(red(bold(`El modelo ${file} no es válido:`)));
    result.issues.forEach((i) => console.error('  ' + formatIssue(i)));
    return 1;
  }

  const fmt = new Formatter(result.model);
  result.warnings.forEach((w) => console.log(formatIssue(w)));
  report(result.model, analyze(result.model), fmt);
  return 0;
}

function report(model: CustodyModel, a: Analysis, fmt: Formatter) {
  const out: string[] = [];
  const section = (title: string) => out.push('', bold(title));
  const bySize = <T>(cuts: T[][], size: number | null) => cuts.filter((c) => c.length === size);
  const label = (id: string) => model.locations.find((l) => l.id === id)?.name ?? id;

  out.push(bold(`🔧 ${model.name}`) + dim(`  — política ${fmt.policy()}`));
  if (model.description) out.push(dim(model.description));

  section('Puntuación');
  const sizeText = (n: number | null, upTo: number) => (n === null ? `ninguna combinación de ≤${upTo}` : `${n} a la vez`);
  out.push(`  Seguridad    ${scoreBar(a.security.score)}  ${dim('robo con ' + sizeText(a.security.minSize, a.security.searchedUpTo))}`);
  out.push(`  Resiliencia  ${scoreBar(a.resilience.score)}  ${dim('pérdida con ' + sizeText(a.resilience.minSize, a.resilience.searchedUpTo))}`);
  out.push(`  Usabilidad   ${scoreBar(a.usability.score)}  ${dim(a.usability.locations ? `firmar visitando ${a.usability.locations.length} ubicación(es)` : 'el titular no puede firmar de forma segura')}`);
  const inh = a.inheritance;
  const inhText = inh.status === 'ok' ? `herederos recuperan visitando ${inh.locations!.length} ubicación(es)` : inh.status === 'no-heirs' ? 'no hay herederos definidos' : 'los herederos NO pueden recuperar los fondos';
  out.push(`  Herencia     ${scoreBar(inh.score)}  ${dim(inhText)}`);

  section('🕵️  Formas más baratas de robar');
  const thefts = bySize(a.security.cuts, a.security.minSize);
  if (thefts.length === 0) out.push(green(`  Ninguna combinación de hasta ${a.security.searchedUpTo} ataques permite robar.`));
  thefts.forEach((cut) => out.push(red('  • ' + cut.map((x) => fmt.attack(x)).join('  +  '))));
  if (a.security.cuts.length > thefts.length) out.push(dim(`  (+${a.security.cuts.length - thefts.length} combinaciones mínimas más grandes)`));
  const firstTheft = thefts[0];
  if (firstTheft) {
    out.push('', dim('  Por qué:'));
    const node = explain(simulateAttack(model, firstTheft), 'spend');
    if (node) out.push(...fmt.tree(node, '    '));
  }

  section('🔥 Formas más baratas de perder los fondos');
  const losses = bySize(a.resilience.cuts, a.resilience.minSize);
  if (!a.resilience.recoverableNow) out.push(red('  ¡Ya ahora mismo nadie puede recuperar los fondos!'));
  else if (losses.length === 0) out.push(green(`  Ninguna combinación de hasta ${a.resilience.searchedUpTo} pérdidas deja los fondos inaccesibles.`));
  losses.forEach((cut) => out.push(red('  • ' + cut.map((x) => fmt.loss(x)).join('  +  '))));
  if (a.resilience.cuts.length > losses.length) out.push(dim(`  (+${a.resilience.cuts.length - losses.length} combinaciones mínimas más grandes)`));

  section('✍️  Firma del día a día');
  if (a.usability.locations) {
    out.push(`  Desde: ${a.usability.locations.map(label).join(' + ')}`);
  } else {
    out.push(red('  El titular no puede firmar usando solo dispositivos de firma.'));
  }

  section('⚰️  Herencia');
  if (inh.status === 'ok') {
    out.push(`  Tras el fallecimiento del titular, ${inh.heirs.map((h) => model.people.find((p) => p.id === h)?.name ?? h).join(', ')} recupera(n) desde: ${inh.locations!.map(label).join(' + ')}`);
    const node = explain(simulateLosses(model, model.people.filter((p) => p.role === 'owner').map((p) => ({ type: 'death', person: p.id }))), 'spend');
    if (node) out.push(...fmt.tree(node, '    '));
  } else {
    out.push(red(`  ${inhText}`));
  }

  console.log(out.join('\n'));
}

process.exitCode = await main(process.argv.slice(2));
