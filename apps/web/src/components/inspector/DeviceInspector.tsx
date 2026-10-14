import { advisoriesFor, catalogModelByName, flatPolicy, miniscriptSupport, updateDevice, type CatalogModel, type CustodyModel, type Device, type SecretRef } from '@llave-inglesa/domain';
import { tamperRisk } from '@llave-inglesa/engine';
import { AlertTriangle, Camera, Cpu } from 'lucide-react';
import { TAMPER_REASON_TEXT, UI } from '../../lib/text.ts';
import { removeElement } from '../../lib/remove.ts';
import { useDocument } from '../../store/document.ts';
import { Button, DeleteButton, Field, PanelHeader, Section, SecretToggles, Segmented, Select, Switch, TextInput } from './fields.tsx';
import { DuressNotes } from '../Findings.tsx';
import { AdvisoryList, catalogFeatures, HardwareModelSelect } from './Hardware.tsx';
import styles from './fields.module.css';

const T = UI.dispositivo;
/** Se calcula al pintar: las etiquetas siguen al idioma activo. */
const kindOptions = () => (['stateful', 'stateless'] as const).map((value) => ({ value, label: T.tipos[value] }));
const assemblyOptions = () => (['unset', 'self', 'bought'] as const).map((value) => ({ value, label: T.montajes[value] }));
const sealOptions = () => (['unset', 'intact', 'broken'] as const).map((value) => ({ value, label: T.precintos[value] }));
const sourceOptions = () =>
  (['unset', 'manufacturer', 'official-reseller', 'unofficial-shop', 'second-hand'] as const).map((value) => ({ value, label: T.compras[value] }));

type Origin = NonNullable<Device['origin']>;
/** Cambia un campo de la procedencia ('unset' lo quita); sin ninguno, la procedencia queda sin indicar. */
function withOrigin<K extends keyof Origin>(origin: Device['origin'], key: K, value: Origin[K] | 'unset'): Device['origin'] {
  const next: Origin = { ...origin };
  if (value === 'unset') delete next[key];
  else next[key] = value as Origin[K];
  return Object.keys(next).length > 0 ? next : undefined;
}

function duressHint(catalog: CatalogModel | undefined): string {
  const kinds = catalog?.duress ?? [];
  if (kinds.includes('decoy') && kinds.includes('wipe')) return T.coaccion.ambas;
  if (kinds.includes('decoy')) return T.coaccion.senuelo;
  if (kinds.includes('wipe')) return T.coaccion.borrado;
  return T.coaccion.generico;
}

export function DeviceInspector({ model, device }: { model: CustodyModel; device: Device }) {
  const apply = useDocument((s) => s.apply);
  const id = device.id;
  const patch = (p: Partial<Device>, field?: string) => apply((m) => updateDevice(m, id, p), field && `device:${id}:${field}`);

  // Reutilizamos el selector de secretos: cada key se muestra como "guardada en el dispositivo".
  const keyOptions = model.keys.map((k): SecretRef => ({ type: 'seed', key: k.id }));
  const held = device.holds.map((key): SecretRef => ({ type: 'seed', key }));
  const loaded = (device.loads ?? []).map((key): SecretRef => ({ type: 'seed', key }));

  const catalog = catalogModelByName(device.model);
  const risk = tamperRisk(device);
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
      <PanelHeader icon={device.kind === 'stateful' ? Cpu : Camera} kind={T.tipo} title={device.label} />

      <Section>
        <Field label={UI.campos.nombre}>{(fid) => <TextInput id={fid} value={device.label} onChange={(label) => patch({ label }, 'label')} />}</Field>
        <Field label={T.modelo}>{(fid) => <HardwareModelSelect id={fid} value={catalog} onChange={pickModel} />}</Field>
        {!catalog && (
          <div className={styles.twoCols}>
            <Field label={T.fabricante}>{(fid) => <TextInput id={fid} value={device.vendor} onChange={(vendor) => patch({ vendor }, 'vendor')} />}</Field>
            <Field label={T.nombreModelo}>
              {(fid) => <TextInput id={fid} value={device.model ?? ''} placeholder={T.opcional} optional onChange={(v) => patch({ model: v || undefined }, 'model')} />}
            </Field>
          </div>
        )}
        <Field label={T.firmware}>
          {(fid) => <TextInput id={fid} value={device.firmware ?? ''} placeholder={T.pistaFirmware} optional onChange={(v) => patch({ firmware: v || undefined }, 'firmware')} />}
        </Field>
        {catalog && <p className={styles.hint}>{catalogFeatures(catalog)}</p>}
        <AdvisoryList matches={advisories} />
        {!flatPolicy(model) && <MiniscriptNote device={device} catalog={catalog} />}
        <Field label={UI.campos.ubicacion}>
          {(fid) => (
            <Select id={fid} value={device.location} options={model.locations.map((l) => ({ value: l.id, label: l.name }))} onChange={(location) => patch({ location })} />
          )}
        </Field>
      </Section>

      <Section title={T.tipoTitulo}>
        <Segmented label={T.tipoDispositivo} value={device.kind} options={kindOptions()} onChange={(kind) => patch({ kind })} />
        <p className={styles.hint}>
          {device.kind === 'stateful'
            ? T.pistaStateful
            : T.pistaStateless}
        </p>
      </Section>

      {device.kind === 'stateful' && (
        <Section title={T.keysQueGuarda}>
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
          title={T.keysQueFirmas}
          action={
            device.kind === 'stateless' &&
            device.loads && (
              <Button onClick={() => patch({ loads: undefined })} title={T.pistaSinIndicar}>
                {T.sinIndicar}
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
              ? T.cargasSinIndicar
              : T.cargas}{' '}
            {catalog?.antiExfil
              ? T.antiExfil
              : T.sinAntiExfil}
          </p>
        </Section>
      )}

      <Section title={T.seguridad}>
        <Switch checked={device.pinProtected} onChange={(pinProtected) => patch({ pinProtected })} label={T.pin} hint={T.pistaPin} />
        {device.pinProtected && (!catalog || catalog.duress.length > 0) && (
          <Switch
            checked={device.duressPin}
            onChange={(duressPin) => patch({ duressPin })}
            label={T.pinCoaccion}
            hint={`${duressHint(catalog)} ${T.coaccion.noLaEvita}`}
          />
        )}
        {device.pinProtected && device.duressPin && <DuressNotes model={model} device={device.id} />}
        {device.kind === 'stateful' && (
          <>
            <Switch
              checked={device.acceptsExternalSeed}
              onChange={(acceptsExternalSeed) => patch({ acceptsExternalSeed })}
              label={T.semillasExternas}
              hint={T.pistaSemillasExternas}
            />
            {(!catalog || catalog.registersMultisig) && (
              <Switch
                checked={device.registeredWallet}
                onChange={(registeredWallet) => patch({ registeredWallet })}
                label={T.multisigRegistrado}
                hint={T.pistaMultisig}
              />
            )}
          </>
        )}
      </Section>

      <Section title={T.procedencia}>
        {catalog?.diy && (
          <Segmented
            label={T.montaje}
            value={device.origin?.assembly ?? 'unset'}
            options={assemblyOptions()}
            onChange={(v) => patch({ origin: withOrigin(device.origin, 'assembly', v) })}
          />
        )}
        {catalog?.diy && device.origin?.assembly === 'self' ? (
          <p className={styles.hint}>{T.pistaMontadoEnCasa}</p>
        ) : (
          <>
            <div className={styles.twoCols}>
              <Field label={T.precinto}>
                {(fid) => (
                  <Select id={fid} value={device.origin?.seal ?? 'unset'} options={sealOptions()} onChange={(v) => patch({ origin: withOrigin(device.origin, 'seal', v) })} />
                )}
              </Field>
              <Field label={T.compra}>
                {(fid) => (
                  <Select id={fid} value={device.origin?.source ?? 'unset'} options={sourceOptions()} onChange={(v) => patch({ origin: withOrigin(device.origin, 'source', v) })} />
                )}
              </Field>
            </div>
            <p className={styles.hint}>{risk ? T.riesgo(TAMPER_REASON_TEXT[risk.reason], UI.comun.numero(risk.effort)) : T.pistaProcedencia}</p>
          </>
        )}
      </Section>

      <DeleteButton
        label={T.eliminar}
        onClick={() => void removeElement({ kind: 'device', id })}
      />
    </>
  );
}

/** Con una política que necesita Miniscript: si este dispositivo puede firmarla. */
function MiniscriptNote({ device, catalog }: { device: Device; catalog: CatalogModel | undefined }) {
  const support = miniscriptSupport(device);
  const M = T.miniscript;
  const text =
    support === 'unsupported'
      ? M.unsupported
      : support === 'old-firmware'
        ? M['old-firmware'](catalog!.miniscript!.since!)
        : support === 'edge'
          ? device.firmware?.trim()
            ? M.edge
            : M.edgeSinVersion
          : null;
  if (!text) return null;
  return (
    <p className={styles.warningHint}>
      <AlertTriangle size={12} aria-hidden /> {text}
    </p>
  );
}
