import { removeDevice, updateDevice, type CustodyModel, type Device, type SecretRef } from '@llave-inglesa/domain';
import { Camera, Cpu } from 'lucide-react';
import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { DeleteButton, Field, PanelHeader, Section, SecretToggles, Segmented, Select, Switch, TextInput } from './fields.tsx';
import styles from './fields.module.css';

const KIND_OPTIONS = [
  { value: 'stateful', label: 'Guarda keys' },
  { value: 'stateless', label: 'Stateless' },
] as const;

export function DeviceInspector({ model, device }: { model: CustodyModel; device: Device }) {
  const apply = useDocument((s) => s.apply);
  const select = useSelection((s) => s.select);
  const id = device.id;
  const patch = (p: Partial<Device>, field?: string) => apply((m) => updateDevice(m, id, p), field && `device:${id}:${field}`);

  // Reutilizamos el selector de secretos: cada key se muestra como "guardada en el dispositivo".
  const keyOptions = model.keys.map((k): SecretRef => ({ type: 'seed', key: k.id }));
  const held = device.holds.map((key): SecretRef => ({ type: 'seed', key }));

  return (
    <>
      <PanelHeader icon={device.kind === 'stateful' ? Cpu : Camera} kind="Dispositivo" title={device.label} onClose={() => select(null)} />

      <Section>
        <Field label="Nombre">{(fid) => <TextInput id={fid} value={device.label} onChange={(label) => patch({ label }, 'label')} />}</Field>
        <div className={styles.twoCols}>
          <Field label="Fabricante">{(fid) => <TextInput id={fid} value={device.vendor} onChange={(vendor) => patch({ vendor }, 'vendor')} />}</Field>
          <Field label="Modelo">
            {(fid) => <TextInput id={fid} value={device.model ?? ''} placeholder="opcional" onChange={(v) => patch({ model: v || undefined }, 'model')} />}
          </Field>
        </div>
        <Field label="Ubicación">
          {(fid) => (
            <Select id={fid} value={device.location} options={model.locations.map((l) => ({ value: l.id, label: l.name }))} onChange={(location) => patch({ location })} />
          )}
        </Field>
      </Section>

      <Section title="Tipo">
        <Segmented label="Tipo de dispositivo" value={device.kind} options={KIND_OPTIONS} onChange={(kind) => patch({ kind })} />
        <p className={styles.hint}>
          {device.kind === 'stateful'
            ? 'Guarda las keys en su memoria (Coldcard, Jade, Passport…). Quien lo tenga y sepa el PIN puede firmar.'
            : 'No guarda nada: hay que cargarle la semilla cada vez (SeedSigner, Krux…).'}
        </p>
      </Section>

      {device.kind === 'stateful' && (
        <Section title="Keys que guarda">
          <SecretToggles
            model={model}
            options={keyOptions}
            selected={held}
            onToggle={(s) => {
              if (s.type !== 'seed') return;
              const holds = device.holds.includes(s.key) ? device.holds.filter((k) => k !== s.key) : [...device.holds, s.key];
              patch({ holds });
            }}
          />
        </Section>
      )}

      <Section title="Seguridad y funciones">
        <Switch checked={device.pinProtected} onChange={(pinProtected) => patch({ pinProtected })} label="Protegido por PIN" hint="Quien sepa el PIN se indica en la ficha de cada persona." />
        {device.kind === 'stateful' && (
          <>
            <Switch
              checked={device.acceptsExternalSeed}
              onChange={(acceptsExternalSeed) => patch({ acceptsExternalSeed })}
              label="Firma con semillas externas"
              hint="Puede cargar temporalmente otra semilla para firmar con ella."
            />
            <Switch
              checked={device.registeredWallet}
              onChange={(registeredWallet) => patch({ registeredWallet })}
              label="Multisig registrado"
              hint="Guarda la configuración del wallet, y por tanto todas las xpubs."
            />
          </>
        )}
      </Section>

      <DeleteButton
        label="Eliminar dispositivo"
        onClick={() => {
          apply((m) => removeDevice(m, id));
          select(null);
        }}
      />
    </>
  );
}
