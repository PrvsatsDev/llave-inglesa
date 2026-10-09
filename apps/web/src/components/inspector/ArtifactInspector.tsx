import { removeArtifact, setArtifactPassword, updateArtifact, type Artifact, type CustodyModel, type SecretRef } from '@llave-inglesa/domain';
import { RectangleHorizontal } from 'lucide-react';
import { sameSecret, secretOptions, toggleSecret } from '../../lib/secrets.ts';
import { UI } from '../../lib/text.ts';
import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { DeleteButton, Field, PanelHeader, Section, SecretToggles, Select, Switch, TextInput } from './fields.tsx';
import styles from './fields.module.css';

const T = UI.backup;
const MEDIUM_OPTIONS = (['metal', 'washers', 'paper', 'digital', 'other'] as const).map((value) => ({ value, label: T.soportes[value] }));

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
      <PanelHeader icon={RectangleHorizontal} kind={T.tipo} title={artifact.label} />

      <Section>
        <Field label={UI.campos.nombre}>{(fid) => <TextInput id={fid} value={artifact.label} onChange={(label) => patch({ label }, 'label')} />}</Field>
        <div className={styles.twoCols}>
          <Field label={T.soporte}>{(fid) => <Select id={fid} value={artifact.medium} options={MEDIUM_OPTIONS} onChange={(medium) => patch({ medium })} />}</Field>
          <Field label={UI.campos.ubicacion}>
            {(fid) => (
              <Select id={fid} value={artifact.location} options={model.locations.map((l) => ({ value: l.id, label: l.name }))} onChange={(location) => patch({ location })} />
            )}
          </Field>
        </div>
      </Section>

      <Section title={T.queContiene}>
        <SecretToggles model={model} options={options} selected={artifact.contents} onToggle={(s) => patch({ contents: toggleSecret(artifact.contents, s) })} />
        <p className={styles.hint}>{T.pistaContenido}</p>
      </Section>

      <Section title={T.cifrado}>
        <Switch
          checked={hasPassword}
          onChange={(enabled) => apply((m) => setArtifactPassword(m, id, enabled))}
          label={T.conContrasena}
          hint={T.pistaContrasena}
        />
        <p className={styles.label}>{T.tambienCon}</p>
        <SecretToggles
          model={model}
          options={options.filter((o) => !isOwnPassword(o) && !artifact.contents.some((c) => sameSecret(c, o)))}
          selected={artifact.lockedBy}
          onToggle={(s) => patch({ lockedBy: toggleSecret(artifact.lockedBy, s) })}
        />
        <p className={styles.hint}>{T.pistaTambien}</p>
      </Section>

      <DeleteButton
        label={T.eliminar}
        onClick={() => {
          apply((m) => removeArtifact(m, id));
          back();
        }}
      />
    </>
  );
}
