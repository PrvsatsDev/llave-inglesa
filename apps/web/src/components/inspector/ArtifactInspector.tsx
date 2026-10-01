import { removeArtifact, setArtifactPassword, updateArtifact, type Artifact, type CustodyModel, type SecretRef } from '@llave-inglesa/domain';
import { RectangleHorizontal } from 'lucide-react';
import { sameSecret, secretOptions, toggleSecret } from '../../lib/secrets.ts';
import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { DeleteButton, Field, PanelHeader, Section, SecretToggles, Select, Switch, TextInput } from './fields.tsx';
import styles from './fields.module.css';

const MEDIUM_OPTIONS = [
  { value: 'metal', label: 'Metal (placa)' },
  { value: 'washers', label: 'Arandelas' },
  { value: 'paper', label: 'Papel' },
  { value: 'digital', label: 'Digital' },
  { value: 'other', label: 'Otro' },
] as const;

export function ArtifactInspector({ model, artifact }: { model: CustodyModel; artifact: Artifact }) {
  const apply = useDocument((s) => s.apply);
  const back = useSelection((s) => s.back);
  const id = artifact.id;
  const patch = (p: Partial<Artifact>, field?: string) => apply((m) => updateArtifact(m, id, p), field && `artifact:${id}:${field}`);
  const options = secretOptions(model);
  const isOwnPassword = (s: SecretRef) => s.type === 'password' && s.artifact === id;
  const hasPassword = artifact.lockedBy.some(isOwnPassword);

  return (
    <>
      <PanelHeader icon={RectangleHorizontal} kind="Backup" title={artifact.label} />

      <Section>
        <Field label="Nombre">{(fid) => <TextInput id={fid} value={artifact.label} onChange={(label) => patch({ label }, 'label')} />}</Field>
        <div className={styles.twoCols}>
          <Field label="Soporte">{(fid) => <Select id={fid} value={artifact.medium} options={MEDIUM_OPTIONS} onChange={(medium) => patch({ medium })} />}</Field>
          <Field label="Ubicación">
            {(fid) => (
              <Select id={fid} value={artifact.location} options={model.locations.map((l) => ({ value: l.id, label: l.name }))} onChange={(location) => patch({ location })} />
            )}
          </Field>
        </div>
      </Section>

      <Section title="Qué contiene">
        <SecretToggles model={model} options={options} selected={artifact.contents} onToggle={(s) => patch({ contents: toggleSecret(artifact.contents, s) })} />
        <p className={styles.hint}>Un backup tiene que contener algo: el último elemento no se puede quitar.</p>
      </Section>

      <Section title="Cifrado">
        <Switch
          checked={hasPassword}
          onChange={(enabled) => apply((m) => setArtifactPassword(m, id, enabled))}
          label="Cifrado con contraseña"
          hint="Quien sepa la contraseña se indica en la ficha de cada persona (o en otro backup donde esté apuntada)."
        />
        <p className={styles.label}>También cifrado con</p>
        <SecretToggles
          model={model}
          options={options.filter((o) => !isOwnPassword(o) && !artifact.contents.some((c) => sameSecret(c, o)))}
          selected={artifact.lockedBy}
          onToggle={(s) => patch({ lockedBy: toggleSecret(artifact.lockedBy, s) })}
        />
        <p className={styles.hint}>Otros secretos necesarios para leerlo (p. ej. un fichero cifrado con la clave de un dispositivo).</p>
      </Section>

      <DeleteButton
        label="Eliminar backup"
        onClick={() => {
          apply((m) => removeArtifact(m, id));
          back();
        }}
      />
    </>
  );
}
