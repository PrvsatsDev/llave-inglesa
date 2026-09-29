import { removePerson, updatePerson, type CustodyModel, type Person } from '@llave-inglesa/domain';
import { MapPin, User } from 'lucide-react';
import { secretOptions, toggleSecret } from '../../lib/secrets.ts';
import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { DeleteButton, Field, PanelHeader, Section, SecretToggles, Select, TextInput } from './fields.tsx';
import styles from './fields.module.css';

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Titular' },
  { value: 'heir', label: 'Heredero/a' },
  { value: 'custodian', label: 'Custodio/a' },
  { value: 'other', label: 'Otra persona' },
] as const;

export function PersonInspector({ model, person }: { model: CustodyModel; person: Person }) {
  const apply = useDocument((s) => s.apply);
  const select = useSelection((s) => s.select);
  const id = person.id;
  const isLastOwner = person.role === 'owner' && model.people.filter((p) => p.role === 'owner').length === 1;
  const access = model.locations.flatMap((l) => l.access.filter((a) => a.person === id).map((a) => ({ location: l, when: a.when })));

  return (
    <>
      <PanelHeader icon={User} kind="Persona" title={person.name} onClose={() => select(null)} />

      <Section>
        <Field label="Nombre">
          {(fid) => <TextInput id={fid} value={person.name} onChange={(name) => apply((m) => updatePerson(m, id, { name }), `person:${id}:name`)} />}
        </Field>
        <Field label="Rol" hint={isLastOwner ? 'Es el único titular: asigna otro antes de cambiarle el rol.' : undefined}>
          {(fid) =>
            isLastOwner ? (
              <Select id={fid} value={person.role} options={ROLE_OPTIONS.filter((o) => o.value === 'owner')} onChange={() => {}} />
            ) : (
              <Select id={fid} value={person.role} options={ROLE_OPTIONS} onChange={(role) => apply((m) => updatePerson(m, id, { role }))} />
            )
          }
        </Field>
      </Section>

      <Section title="Sabe de memoria">
        <SecretToggles
          model={model}
          options={secretOptions(model)}
          selected={person.knows}
          onToggle={(s) => apply((m) => updatePerson(m, id, { knows: toggleSecret(person.knows, s) }))}
        />
        <p className={styles.hint}>Lo que recuerda sin apuntarlo. Un atacante que le coaccione lo obtiene.</p>
      </Section>

      <Section title="Puede entrar en">
        {access.length === 0 && <p className={styles.hint}>En ningún sitio. Los accesos se editan desde cada ubicación.</p>}
        <ul className={styles.list}>
          {access.map(({ location, when }) => (
            <li key={location.id}>
              <button className={styles.rowButton} onClick={() => select({ kind: 'location', id: location.id })}>
                <MapPin size={14} aria-hidden />
                {location.name}
                <span className={`${styles.rowMeta} ${styles.hint}`}>
                  {when.type === 'always'
                    ? 'siempre'
                    : `${when.type === 'after-death' ? 'tras fallecer' : 'si no puede actuar'} ${model.people.find((p) => p.id === when.person)?.name ?? '?'}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <DeleteButton
        label="Eliminar persona"
        onClick={() => {
          apply((m) => removePerson(m, id));
          select(null);
        }}
        disabled={isLastOwner}
        reason="Tiene que haber al menos un titular."
      />
    </>
  );
}
