import { removePerson, updatePerson, type CustodyModel, type Person } from '@llave-inglesa/domain';
import { MapPin, User } from 'lucide-react';
import { secretOptions, toggleSecret } from '../../lib/secrets.ts';
import { UI } from '../../lib/text.ts';
import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { DeleteButton, Field, PanelHeader, Section, SecretToggles, Select, TextInput } from './fields.tsx';
import styles from './fields.module.css';

const T = UI.persona;
const ROLE_OPTIONS = (['owner', 'heir', 'custodian', 'other'] as const).map((value) => ({ value, label: T.roles[value] }));

export function PersonInspector({ model, person }: { model: CustodyModel; person: Person }) {
  const apply = useDocument((s) => s.apply);
  const back = useSelection((s) => s.back);
  const open = useSelection((s) => s.open);
  const id = person.id;
  const isLastOwner = person.role === 'owner' && model.people.filter((p) => p.role === 'owner').length === 1;
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
              <Select id={fid} value={person.role} options={ROLE_OPTIONS.filter((o) => o.value === 'owner')} onChange={() => {}} />
            ) : (
              <Select id={fid} value={person.role} options={ROLE_OPTIONS} onChange={(role) => apply((m) => updatePerson(m, id, { role }))} />
            )
          }
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
                    : `${when.type === 'after-death' ? T.trasFallecer : T.siNoPuede} ${model.people.find((p) => p.id === when.person)?.name ?? T.desconocida}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <DeleteButton
        label={T.eliminar}
        onClick={() => {
          apply((m) => removePerson(m, id));
          back();
        }}
        disabled={isLastOwner}
        reason={T.haceFaltaTitular}
      />
    </>
  );
}
