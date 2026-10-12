import { addComputer, canLiveAt, setPersonHome, updatePerson, type CustodyModel, type Person } from '@llave-inglesa/domain';
import { MapPin, Smartphone, User } from 'lucide-react';
import { secretOptions, toggleSecret } from '../../lib/secrets.ts';
import { UI } from '../../lib/text.ts';
import { removeElement } from '../../lib/remove.ts';
import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { Button, DeleteButton, Field, PanelHeader, Section, SecretToggles, Select, TextInput } from './fields.tsx';
import styles from './fields.module.css';

const T = UI.persona;
/** Se calcula al pintar: las etiquetas siguen al idioma activo. */
const roleOptions = () => (['owner', 'heir', 'custodian', 'other'] as const).map((value) => ({ value, label: T.roles[value] }));

export function PersonInspector({ model, person }: { model: CustodyModel; person: Person }) {
  const apply = useDocument((s) => s.apply);
  const open = useSelection((s) => s.open);
  const id = person.id;
  const isLastOwner = person.role === 'owner' && model.people.filter((p) => p.role === 'owner').length === 1;
  const homes = [{ value: '', label: T.sinIndicar }, ...model.locations.filter((l) => canLiveAt(model, l.id)).map((l) => ({ value: l.id, label: l.name }))];
  const carried = model.computers.filter((c) => c.carriedBy === id);
  const addPhone = () => {
    let created = '';
    apply((m) => {
      const r = addComputer(m, { carriedBy: id }, UI.nuevos.movil(person.name));
      created = r.id;
      return r.model;
    });
    open({ kind: 'computer', id: created });
  };
  const access = model.locations.flatMap((l) => l.access.filter((a) => a.person === id).map((a) => ({ location: l, when: a.when })));

  return (
    <>
      <PanelHeader icon={User} kind={T.tipo} title={person.name} />

      <Section>
        <Field label={UI.campos.nombre}>
          {(fid) => <TextInput id={fid} value={person.name} onChange={(name) => apply((m) => updatePerson(m, id, { name }), `person:${id}:name`)} />}
        </Field>
        <Field label={T.rol} hint={isLastOwner ? T.unicoTitular : undefined}>
          {(fid) =>
            isLastOwner ? (
              <Select id={fid} value={person.role} options={roleOptions().filter((o) => o.value === 'owner')} onChange={() => {}} />
            ) : (
              <Select id={fid} value={person.role} options={roleOptions()} onChange={(role) => apply((m) => updatePerson(m, id, { role }))} />
            )
          }
        </Field>
        <Field label={T.viveEn} hint={person.livesAt === undefined ? T.pistaSinIndicar : T.pistaViveEn}>
          {(fid) => <Select id={fid} value={person.livesAt ?? ''} options={homes} onChange={(home) => apply((m) => setPersonHome(m, id, home || undefined))} />}
        </Field>
      </Section>

      <Section title={T.sabeDeMemoria}>
        <SecretToggles
          model={model}
          options={secretOptions(model)}
          selected={person.knows}
          onToggle={(s) => apply((m) => updatePerson(m, id, { knows: toggleSecret(person.knows, s) }))}
        />
        <p className={styles.hint}>{T.pistaMemoria}</p>
      </Section>

      <Section title={T.puedeEntrar}>
        {access.length === 0 && <p className={styles.hint}>{T.enNingunSitio}</p>}
        <ul className={styles.list}>
          {access.map(({ location, when }) => (
            <li key={location.id}>
              <button className={styles.rowButton} onClick={() => open({ kind: 'location', id: location.id })}>
                <MapPin size={14} aria-hidden />
                {location.name}
                <span className={`${styles.rowMeta} ${styles.hint}`}>
                  {when.type === 'always'
                    ? T.siempre
                    : (when.type === 'after-death' ? T.trasFallecer : T.siNoPuede)(model.people.find((p) => p.id === when.person)?.name ?? T.desconocida)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={T.llevaEncima} action={<Button icon={Smartphone} onClick={addPhone}>{T.movil}</Button>}>
        {carried.length === 0 && <p className={styles.hint}>{T.pistaLlevaEncima}</p>}
        <ul className={styles.list}>
          {carried.map((c) => (
            <li key={c.id}>
              <button className={styles.rowButton} onClick={() => open({ kind: 'computer', id: c.id })}>
                <Smartphone size={14} aria-hidden />
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <DeleteButton
        label={T.eliminar}
        onClick={() => void removeElement({ kind: 'person', id })}
        disabled={isLastOwner}
        reason={T.haceFaltaTitular}
      />
    </>
  );
}
