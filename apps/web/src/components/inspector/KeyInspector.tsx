import { activeHolds, advisoriesFor, catalogModelByName, indexModel, isBlankProvenance, removeKey, setKeyGeneratedOn, updateKey, type CustodyModel, type EntropySource, type Key, type Provenance } from '@llave-inglesa/domain';
import { AlertTriangle, Cpu, KeyRound, MapPin, Plus, X } from 'lucide-react';
import { UI } from '../../lib/text.ts';
import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { Button, DeleteButton, Field, PanelHeader, Section, Segmented, Select, Switch, TextInput } from './fields.tsx';
import { AdvisoryList, HardwareModelSelect, UNKNOWN_VENDOR, VendorSelect } from './Hardware.tsx';
import { PathField, XpubField } from './WalletFields.tsx';
import styles from './fields.module.css';

type SourceKind = EntropySource['kind'];

const T = UI.key;

/** Proyecto de Estudio Bitcoin para generar la semilla a mano con una moneda. */
const SEMILLA_MONEDA_URL = 'https://estudiobitcoin.com/semilla-moneda-crea-tu-semilla-a-mano/';

const SOURCE_OPTIONS: readonly { value: SourceKind; label: string }[] = (['device-rng', 'software-rng', 'dice', 'coin', 'cards', 'unknown'] as const).map((value) => ({
  value,
  label: T.fuentes[value],
}));

function emptySource(kind: SourceKind): EntropySource {
  switch (kind) {
    case 'device-rng':
    case 'software-rng':
      return { kind, vendor: UNKNOWN_VENDOR };
    case 'dice':
    case 'coin':
    case 'cards':
      return { kind };
    case 'unknown':
      return { kind };
  }
}

function SourceRow({ source, onChange, onRemove, canRemove }: { source: EntropySource; onChange(s: EntropySource): void; onRemove(): void; canRemove: boolean }) {
  return (
    <li className={styles.row}>
      <span className={styles.rowGrow}>
        <Select value={source.kind} options={SOURCE_OPTIONS} onChange={(kind) => onChange(emptySource(kind))} />
      </span>
      {source.kind === 'device-rng' && (
        <span className={styles.rowGrow}>
          <VendorSelect value={source.vendor} onChange={(vendor) => onChange({ ...source, vendor })} />
        </span>
      )}
      {source.kind === 'software-rng' && (
        <span className={styles.rowGrow}>
          <TextInput value={source.vendor} placeholder={T.software} onChange={(vendor) => onChange({ ...source, vendor })} />
        </span>
      )}
      {(source.kind === 'dice' || source.kind === 'coin' || source.kind === 'cards') && (
        <span className={styles.rowGrow}>
          <input
            className={styles.input}
            type="number"
            min={1}
            placeholder={T.tiradas}
            value={source.count ?? ''}
            onChange={(e) => {
              const count = Number.parseInt(e.target.value, 10);
              onChange(Number.isFinite(count) && count > 0 ? { ...source, count } : { kind: source.kind });
            }}
          />
        </span>
      )}
      <button className={styles.iconButton} onClick={onRemove} disabled={!canRemove} aria-label={T.quitarFuente}>
        <X size={14} />
      </button>
    </li>
  );
}

/** Solo cómo es, nunca cuál es. */
const STRENGTH_OPTIONS = (['weak', 'phrase', 'random'] as const).map((value) => ({ value, label: T.fuerzas[value] }));

const STRENGTH_HINT = T.pistasFuerza;

export function KeyInspector({ model, keyEntity: key }: { model: CustodyModel; keyEntity: Key }) {
  const apply = useDocument((s) => s.apply);
  const back = useSelection((s) => s.back);
  const open = useSelection((s) => s.open);
  const id = key.id;
  const patch = (p: Partial<Key>, field?: string) => apply((m) => updateKey(m, id, p), field && `key:${id}:${field}`);
  const setProvenance = (p: Partial<Provenance>, field?: string) => patch({ provenance: { ...key.provenance, ...p } }, field && `provenance:${field}`);
  const { sources, generatedBy, independentlyVerified } = key.provenance;
  /** Alguna fuente que no es un RNG (dados, moneda, cartas): la única que una verificación puede proteger. */
  const hasOwnEntropy = sources.some((s) => s.kind === 'dice' || s.kind === 'coin' || s.kind === 'cards');
  /** Tu entropía mezclada con un RNG: la parte del RNG es secreta y no se puede recalcular en otra herramienta. */
  const mixesRng = hasOwnEntropy && sources.some((s) => s.kind === 'device-rng' || s.kind === 'software-rng' || s.kind === 'unknown');
  const generatorModel = catalogModelByName(generatedBy?.model);
  const generatorAdvisories = generatorModel ? advisoriesFor(generatorModel.id, generatedBy?.firmware).filter((m) => m.advisory.kind === 'weak-entropy') : [];

  const generateOn = (device: string) => apply((m) => setKeyGeneratedOn(m, id, device));
  /** Dispositivos donde vive o se carga esta key: candidatos a haberla generado. */
  const carriers = model.devices.filter((d) => activeHolds(d).includes(id) || d.loads?.includes(id));

  const index = indexModel(model);
  const places = [
    ...model.devices.filter((d) => activeHolds(d).includes(id)).map((d) => ({ item: d.label, location: d.location, how: T.enMemoria })),
    ...model.artifacts
      .filter((a) => a.contents.some((c) => c.type === 'seed' && c.key === id))
      .map((a) => ({ item: a.label, location: a.location, how: T.fraseSemilla })),
  ];

  return (
    <>
      <PanelHeader icon={KeyRound} kind={T.tipo} title={key.label} />

      <Section>
        <Field label={UI.campos.nombre}>{(fid) => <TextInput id={fid} value={key.label} onChange={(label) => patch({ label }, 'label')} />}</Field>
        <Switch checked={key.passphrase} onChange={(passphrase) => patch({ passphrase })} label={T.requierePassphrase} hint={T.pistaPassphrase} />
        {key.passphrase && (
          <>
            <p className={styles.fieldTitle}>{T.comoEsPassphrase}</p>
            <Segmented
              label={T.comoEsPassphrase}
              value={key.passphraseStrength ?? 'unset'}
              options={STRENGTH_OPTIONS}
              onChange={(v) => v !== 'unset' && patch({ passphraseStrength: v })}
            />
            <p className={key.passphraseStrength ? styles.hint : styles.warningHint}>
              {!key.passphraseStrength && <AlertTriangle size={12} aria-hidden />} {STRENGTH_HINT[key.passphraseStrength ?? 'unset']}
            </p>
          </>
        )}
      </Section>

      <Section title={T.enLaCartera}>
        <div className={styles.twoCols}>
          <Field label={T.fingerprint}>
            {(fid) => (
              <TextInput id={fid} value={key.fingerprint ?? ''} placeholder={T.opcional} optional onChange={(v) => patch({ fingerprint: v || undefined }, 'fingerprint')} />
            )}
          </Field>
          <PathField key={`path:${id}`} value={key.derivation} onChange={(derivation) => patch({ derivation }, 'derivation')} />
        </div>
        <XpubField key={`xpub:${id}`} value={key.xpub} onChange={(xpub) => patch({ xpub }, 'xpub')} />
        <p className={styles.hint}>{T.pistaCartera}</p>
      </Section>

      <Section title={T.dondeEsta}>
        {places.length === 0 && <p className={styles.hint}>{T.enNingunSitio}</p>}
        <ul className={styles.list}>
          {places.map((p, i) => (
            <li key={i}>
              <button className={styles.rowButton} onClick={() => open({ kind: 'location', id: p.location })}>
                <MapPin size={14} aria-hidden />
                {p.item}
                <span className={`${styles.rowMeta} ${styles.hint}`}>
                  {p.how} · {index.label(p.location)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={T.entropia}
        action={
          <Button icon={Plus} onClick={() => setProvenance({ sources: [...sources, { kind: 'dice' }] })}>
            {T.fuente}
          </Button>
        }
      >
        <ul className={styles.list}>
          {sources.map((s, i) => (
            <SourceRow
              key={i}
              source={s}
              canRemove={sources.length > 1}
              onChange={(next) => setProvenance({ sources: sources.map((x, j) => (j === i ? next : x)) }, `source:${i}`)}
              onRemove={() => setProvenance({ sources: sources.filter((_, j) => j !== i) })}
            />
          ))}
        </ul>
        <p className={styles.hint}>{T.pistaMezcla}</p>
        {sources.some((s) => s.kind === 'coin') && (
          <p className={styles.hint}>
            {T.moneda.antes}{' '}
            <a className={styles.link} href={SEMILLA_MONEDA_URL} target="_blank" rel="noopener noreferrer">
              {T.moneda.enlace}
            </a>
            {T.moneda.despues}
          </p>
        )}
      </Section>

      <Section title={T.generacion}>
        {isBlankProvenance(key) && carriers.length > 0 && (
          <div className={styles.suggestion}>
            <p>
              {carriers.length === 1 ? T.estaEn(carriers[0]!.label) : T.estaEnVarios}
            </p>
            <div className={styles.buttonRow}>
              {carriers.map((d) => (
                <Button key={d.id} icon={Cpu} onClick={() => generateOn(d.id)}>
                  {carriers.length === 1 ? T.siRellenar : d.label}
                </Button>
              ))}
            </div>
            <p className={styles.hint}>{T.pistaRellenar}</p>
          </div>
        )}
        <Switch
          checked={!generatedBy}
          onChange={(manual) => setProvenance({ generatedBy: manual ? undefined : { vendor: UNKNOWN_VENDOR } })}
          label={T.aMano}
          hint={T.pistaAMano}
        />
        {generatedBy && (
          <>
            <Field label={T.generadaEn}>
              {(fid) => (
                <HardwareModelSelect
                  id={fid}
                  value={generatorModel}
                  devices={model.devices}
                  onPickDevice={generateOn}
                  onChange={(m) =>
                    setProvenance({ generatedBy: m ? { vendor: m.vendor, model: m.name, firmware: generatedBy.firmware } : { vendor: generatedBy.vendor, firmware: generatedBy.firmware } })
                  }
                />
              )}
            </Field>
            {!generatorModel && (
              <div className={styles.twoCols}>
                <Field label={T.fabricanteOSoftware}>
                  {(fid) => <TextInput id={fid} value={generatedBy.vendor} onChange={(vendor) => setProvenance({ generatedBy: { ...generatedBy, vendor } }, 'vendor')} />}
                </Field>
                <Field label={T.nombreModelo}>
                  {(fid) => (
                    <TextInput id={fid} value={generatedBy.model ?? ''} placeholder={T.opcional} optional onChange={(v) => setProvenance({ generatedBy: { ...generatedBy, model: v || undefined } }, 'model')} />
                  )}
                </Field>
              </div>
            )}
            <Field label={T.firmware}>
              {(fid) => (
                <TextInput
                  optional
                  id={fid}
                  value={generatedBy.firmware ?? ''}
                  placeholder={T.pistaFirmware}
                  onChange={(v) => setProvenance({ generatedBy: { ...generatedBy, firmware: v || undefined } }, 'firmware')}
                />
              )}
            </Field>
            <p className={styles.hint}>{T.firmwareDeEntonces}</p>
            <AdvisoryList matches={generatorAdvisories} />
          </>
        )}
        <Switch
          checked={independentlyVerified}
          onChange={(v) => setProvenance({ independentlyVerified: v })}
          label={T.verificada}
          hint={T.pistaVerificada}
        />
        {!hasOwnEntropy && (
          <p className={independentlyVerified ? styles.warningHint : styles.hint}>
            {independentlyVerified && <AlertTriangle size={12} aria-hidden />} {T.verificarSinEntropiaPropia}
          </p>
        )}
        {mixesRng && (
          <p className={independentlyVerified ? styles.warningHint : styles.hint}>
            {independentlyVerified && <AlertTriangle size={12} aria-hidden />} {T.verificarConRng}
          </p>
        )}
      </Section>

      <DeleteButton
        label={T.eliminar}
        onClick={() => {
          apply((m) => removeKey(m, id));
          back();
        }}
        disabled={model.keys.length <= 1}
        reason={T.haceFaltaKey}
      />
    </>
  );
}
