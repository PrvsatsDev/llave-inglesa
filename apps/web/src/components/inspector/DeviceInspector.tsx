import { advisoriesFor, catalogModelByName, removeDevice, updateDevice, type CatalogModel, type CustodyModel, type Device, type SecretRef } from '@llave-inglesa/domain';
import { Camera, Cpu } from 'lucide-react';
import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { Button, DeleteButton, Field, PanelHeader, Section, SecretToggles, Segmented, Select, Switch, TextInput } from './fields.tsx';
import { AdvisoryList, catalogFeatures, HardwareModelSelect } from './Hardware.tsx';
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
  const loaded = (device.loads ?? []).map((key): SecretRef => ({ type: 'seed', key }));

  const catalog = catalogModelByName(device.model);
  // La entropía débil depende del firmware con el que se generó cada key: se avisa en la key.
  const advisories = catalog ? advisoriesFor(catalog.id, device.firmware).filter((m) => m.advisory.kind !== 'weak-entropy') : [];
  const pickModel = (m: CatalogModel | undefined) =>
    patch(
      m
        ? {
            vendor: m.vendor,
            model: m.name,
            kind: m.kind,
            acceptsExternalSeed: m.acceptsExternalSeed,
            registeredWallet: m.registersMultisig && device.registeredWallet,
          }
        : { model: undefined },
    );

  return (
    <>
      <PanelHeader icon={device.kind === 'stateful' ? Cpu : Camera} kind="Dispositivo" title={device.label} onClose={() => select(null)} />

      <Section>
        <Field label="Nombre">{(fid) => <TextInput id={fid} value={device.label} onChange={(label) => patch({ label }, 'label')} />}</Field>
        <Field label="Modelo">{(fid) => <HardwareModelSelect id={fid} value={catalog} onChange={pickModel} />}</Field>
        {!catalog && (
          <div className={styles.twoCols}>
            <Field label="Fabricante">{(fid) => <TextInput id={fid} value={device.vendor} onChange={(vendor) => patch({ vendor }, 'vendor')} />}</Field>
            <Field label="Nombre del modelo">
              {(fid) => <TextInput id={fid} value={device.model ?? ''} placeholder="opcional" onChange={(v) => patch({ model: v || undefined }, 'model')} />}
            </Field>
          </div>
        )}
        <Field label="Firmware instalado">
          {(fid) => <TextInput id={fid} value={device.firmware ?? ''} placeholder="p. ej. 5.6.0" onChange={(v) => patch({ firmware: v || undefined }, 'firmware')} />}
        </Field>
        {catalog && <p className={styles.hint}>{catalogFeatures(catalog)}</p>}
        <AdvisoryList matches={advisories} />
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

      {(device.kind === 'stateless' || device.acceptsExternalSeed) && (
        <Section
          title="Keys que firmas con él"
          action={
            device.kind === 'stateless' &&
            device.loads && (
              <Button onClick={() => patch({ loads: undefined })} title="Volver a asumir que cualquier semilla puede pasar por él">
                Sin indicar
              </Button>
            )
          }
        >
          <SecretToggles
            model={model}
            options={keyOptions}
            selected={loaded}
            onToggle={(s) => {
              if (s.type !== 'seed') return;
              const current = device.loads ?? [];
              patch({ loads: current.includes(s.key) ? current.filter((k) => k !== s.key) : [...current, s.key] });
            }}
          />
          <p className={styles.hint}>
            {device.loads === undefined && device.kind === 'stateless'
              ? 'Sin indicar: asumimos que cualquier semilla que tengas escrita puede pasar por él.'
              : 'Semillas que cargas en él para firmar.'}{' '}
            {catalog?.antiExfil
              ? 'Tiene anti-exfil: un firmware malicioso no podría filtrarlas en las firmas (si el software con el que firmas lo usa).'
              : 'Un firmware malicioso podría filtrarlas en las firmas.'}
          </p>
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
            {(!catalog || catalog.registersMultisig) && (
              <Switch
                checked={device.registeredWallet}
                onChange={(registeredWallet) => patch({ registeredWallet })}
                label="Multisig registrado"
                hint="Guarda la configuración del wallet, y por tanto todas las xpubs."
              />
            )}
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
