#!/usr/bin/env -S npx tsx
import { readFile } from 'node:fs/promises';
import { indexModel, parseModel, type CustodyModel } from '@llave-inglesa/domain';
import { analyze, explain, simulateAttack, simulateInheritance, type Analysis } from '@llave-inglesa/engine';
import { duressText, inheritanceText } from '@llave-inglesa/text';
import { bold, dim, formatIssue, Formatter, green, red, scoreBar, yellow } from './format.ts';

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
  const num = (n: number) => n.toLocaleString('es');
  const label = (id: string) => model.locations.find((l) => l.id === id)?.name ?? id;

  out.push(bold(`🔧 ${model.name}`) + dim(`  — política ${fmt.policy()}`));
  if (model.description) out.push(dim(model.description));

  section('Puntuación');
  const sec = a.security;
  const secText = sec.minEffort === null
    ? `ningún robo con ≤${sec.searchedUpTo} ataques`
    : `robo con esfuerzo ${sec.minEffort}` + (sec.cheapRoutes > 1 ? ` · ${sec.cheapRoutes} vías igual de baratas` : '');
  out.push(`  Seguridad    ${scoreBar(sec.score)}  ${dim(secText)}`);
  const res = a.resilience;
  const resText = res.minRarity === null ? `ninguna pérdida con ≤${res.searchedUpTo} desgracias` : `pérdida más probable: rareza ${num(res.minRarity)}`;
  out.push(`  Resiliencia  ${scoreBar(res.score)}  ${dim(resText)}`);
  out.push(`  Usabilidad   ${scoreBar(a.usability.score)}  ${dim(a.usability.locations ? `firmar visitando ${a.usability.visits} ubicación(es)` : 'el titular no puede firmar de forma segura')}`);
  const inh = a.inheritance;
  const inhText = inh.status === 'ok' ? `herederos recuperan visitando ${inh.visits} ubicación(es)` : inh.status === 'no-heirs' ? 'no hay herederos definidos' : 'los herederos NO pueden recuperar los fondos';
  out.push(`  Herencia     ${scoreBar(inh.score)}  ${dim(inhText)}`);

  section('🕵️  Formas más baratas de robar');
  const thefts = a.security.cheapest;
  if (thefts.length === 0) out.push(green(`  Ninguna combinación de hasta ${a.security.searchedUpTo} ataques permite robar.`));
  thefts.forEach((cut) => out.push(red('  • ' + cut.map((x) => fmt.attack(x)).join('  +  '))));
  if (a.security.cuts.length > thefts.length) out.push(dim(`  (+${a.security.cuts.length - thefts.length} combinaciones mínimas más costosas)`));
  for (const r of a.duress) out.push((r.helps ? green : yellow)(`  ${duressText(r, a.security, indexModel(model))}`));
  const firstTheft = thefts[0];
  if (firstTheft) {
    out.push('', dim('  Por qué:'));
    const node = explain(simulateAttack(model, firstTheft), 'spend');
    if (node) out.push(...fmt.tree(node, '    '));
  }

  section('🔥 Formas más probables de perder los fondos');
  const losses = res.cheapest;
  if (!a.resilience.recoverableNow) out.push(red('  ¡Ya ahora mismo nadie puede recuperar los fondos!'));
  else if (losses.length === 0) out.push(green(`  Ninguna combinación de hasta ${a.resilience.searchedUpTo} pérdidas deja los fondos inaccesibles.`));
  losses.forEach((cut) => out.push(red('  • ' + cut.map((x) => fmt.loss(x)).join('  +  ')) + dim(`  (rareza ${num(res.minRarity!)})`)));
  if (res.cuts.length > losses.length) out.push(dim(`  (+${res.cuts.length - losses.length} combinaciones mínimas menos probables)`));

  const lockouts = res.lockouts.filter((_, i) => res.lockoutRarities[i] === res.lockoutMinRarity);
  if (lockouts.length > 0) {
    section('⏳ Bloqueos temporales (se resuelven tras el fallecimiento)');
    lockouts.forEach((cut) => out.push(yellow('  • ' + cut.map((x) => fmt.loss(x)).join('  +  '))));
  }

  section('✍️  Firma del día a día');
  if (a.usability.locations) {
    out.push(`  Desde: ${a.usability.locations.map(label).join(' + ')}`);
  } else {
    out.push(red('  El titular no puede firmar usando solo dispositivos de firma.'));
  }

  section('⚰️  Herencia');
  if (inh.status === 'ok') {
    out.push(`  Tras el fallecimiento del titular, ${inheritanceText(inh, model.people)}, yendo a: ${inh.locations!.map(label).join(' + ')}`);
    const node = explain(simulateInheritance(model, inh.locations!, [...inh.heirs, ...inh.helpers]), 'spend');
    if (node) out.push(...fmt.tree(node, '    '));
    const heirLosses = inh.losses.filter((_, i) => inh.lossRarities[i] === inh.lossRarities[0]);
    if (heirLosses.length > 0) {
      out.push('', dim('  Lo más probable que, además, les dejaría sin los fondos:'));
      heirLosses.forEach((cut) => out.push(yellow('  • ' + cut.map((x) => fmt.loss(x)).join('  +  ')) + dim(`  (rareza ${num(inh.lossRarities[0]!)})`)));
      if (inh.losses.length > heirLosses.length) out.push(dim(`  (+${inh.losses.length - heirLosses.length} combinaciones mínimas menos probables)`));
    }
  } else {
    out.push(red(`  ${inheritanceText(inh, model.people)}`));
  }

  console.log(out.join('\n'));
}

process.exitCode = await main(process.argv.slice(2));
