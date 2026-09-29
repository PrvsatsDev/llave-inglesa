import { removeArtifact, updateArtifact, type Artifact, type CustodyModel } from '@llave-inglesa/domain';
import { RectangleHorizontal } from 'lucide-react';
import { sameSecret, secretOptions, toggleSecret } from '../../lib/secrets.ts';
import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { DeleteButton, Field, PanelHeader, Section, SecretToggles, Select, TextInput } from './fields.tsx';
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
  const select = useSelection((s) => s.select);
  const id = artifact.id;
  const patch = (p: Partial<Artifact>, field?: string) => apply((m) => updateArtifact(m, id, p), field && `artifact:${id}:${field}`);
  const options = secretOptions(model);

  return (
    <>
      <PanelHeader icon={RectangleHorizontal} kind="Backup" title={artifact.label} onClose={() => select(null)} />

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

      <Section title="Cifrado con">
        <SecretToggles
          model={model}
          options={options.filter((o) => !artifact.contents.some((c) => sameSecret(c, o)))}
          selected={artifact.lockedBy}
          onToggle={(s) => patch({ lockedBy: toggleSecret(artifact.lockedBy, s) })}
        />
        <p className={styles.hint}>Si está cifrado, hace falta tener también estos secretos para leerlo.</p>
      </Section>

      <DeleteButton
        label="Eliminar backup"
        onClick={() => {
          apply((m) => removeArtifact(m, id));
          select(null);
        }}
      />
    </>
  );
}
