import { setComputerConnects, setComputerPlace, updateComputer, type Computer, type ComputerPlace, type CustodyModel } from '@llave-inglesa/domain';
import { Monitor, Smartphone } from 'lucide-react';
import { hostExploitAdvisory } from '@llave-inglesa/engine';
import { advisoryShortName, UI } from '../../lib/text.ts';
import { removeElement } from '../../lib/remove.ts';
import { useDocument } from '../../store/document.ts';
import { Button, DeleteButton, Field, PanelHeader, Section, Segmented, Select, Switch, TextInput } from './fields.tsx';
import styles from './fields.module.css';

const T = UI.ordenador;
/** Se calcula al pintar: las etiquetas siguen al idioma activo. */
const useOptions = () => (['daily', 'dedicated'] as const).map((value) => ({ value, label: T.usos[value] }));

/** Codifica dónde está como valor de <select>: "l:ubicación" o "p:persona". */
const placeValue = (c: Computer) => (c.carriedBy !== undefined ? `p:${c.carriedBy}` : `l:${c.location ?? ''}`);
const parsePlace = (v: string): ComputerPlace => (v.startsWith('p:') ? { carriedBy: v.slice(2) } : { location: v.slice(2) });

export function ComputerInspector({ model, computer }: { model: CustodyModel; computer: Computer }) {
  const apply = useDocument((s) => s.apply);
  const id = computer.id;
  const patch = (p: Partial<Pick<Computer, 'label' | 'use' | 'wallet'>>, field?: string) => apply((m) => updateComputer(m, id, p), field && `computer:${id}:${field}`);
  const places = [
    ...model.locations.filter((l) => l.kind === 'physical' || l.id === computer.location).map((l) => ({ value: `l:${l.id}`, label: T.guardadoEn(l.name) })),
    ...model.people.map((p) => ({ value: `p:${p.id}`, label: T.loLleva(p.name) })),
  ];

  return (
    <>
      <PanelHeader icon={computer.carriedBy !== undefined ? Smartphone : Monitor} kind={T.tipo} title={computer.label} />

      <Section>
        <Field label={UI.campos.nombre}>{(fid) => <TextInput id={fid} value={computer.label} onChange={(label) => patch({ label }, 'label')} />}</Field>
        <Field label={T.dondeEsta} hint={computer.carriedBy !== undefined ? T.pistaLleva : T.pistaGuardado}>
          {(fid) => <Select id={fid} value={placeValue(computer)} options={places} onChange={(v) => apply((m) => setComputerPlace(m, id, parsePlace(v)))} />}
        </Field>
      </Section>

      <Section title={T.uso}>
        <Segmented label={T.uso} value={computer.use} options={useOptions()} onChange={(use) => patch({ use })} />
        <p className={styles.hint}>{T.pistasUso[computer.use]}</p>
      </Section>

      <Section>
        <Switch checked={computer.wallet} onChange={(wallet) => patch({ wallet })} label={T.cartera} hint={T.pistaCartera} />
      </Section>

      <Section
        title={T.conectados}
        action={
          computer.connects && (
            <Button onClick={() => apply((m) => setComputerConnects(m, id, undefined))} title={T.pistaSinIndicar}>
              {T.sinIndicar}
            </Button>
          )
        }
      >
        {model.devices.length === 0 && <p className={styles.hint}>{T.sinDispositivos}</p>}
        {model.devices.map((d) => {
          const connected = computer.connects?.includes(d.id) ?? true;
          const advisory = hostExploitAdvisory(d);
          const current = computer.connects ?? model.devices.map((x) => x.id);
          return (
            <Switch
              key={d.id}
              checked={connected}
              onChange={(on) => apply((m) => setComputerConnects(m, id, on ? [...current, d.id] : current.filter((x) => x !== d.id)))}
              label={d.label}
              hint={advisory ? T.explotable(advisoryShortName(advisory)) : undefined}
            />
          );
        })}
        <p className={styles.hint}>{computer.connects === undefined ? T.conectadosSinIndicar : T.pistaConectados}</p>
      </Section>

      <DeleteButton label={T.eliminar} onClick={() => void removeElement({ kind: 'computer', id })} />
    </>
  );
}
