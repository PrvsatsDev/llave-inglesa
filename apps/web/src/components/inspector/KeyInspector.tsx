import { activeHolds, advisoriesFor, catalogModelByName, indexModel, isBlankProvenance, removeKey, setKeyGeneratedOn, updateKey, type CustodyModel, type EntropySource, type Key, type Provenance } from '@llave-inglesa/domain';
import { AlertTriangle, Cpu, KeyRound, MapPin, Plus, X } from 'lucide-react';
import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { Button, DeleteButton, Field, PanelHeader, Section, Segmented, Select, Switch, TextInput } from './fields.tsx';
import { AdvisoryList, HardwareModelSelect, VendorSelect } from './Hardware.tsx';
import { PathField, XpubField } from './WalletFields.tsx';
import styles from './fields.module.css';

type SourceKind = EntropySource['kind'];

/** Proyecto de Estudio Bitcoin para generar la semilla a mano con una moneda. */
const SEMILLA_MONEDA_URL = 'https://estudiobitcoin.com/semilla-moneda-crea-tu-semilla-a-mano/';

const SOURCE_OPTIONS: readonly { value: SourceKind; label: string }[] = [
  { value: 'device-rng', label: 'RNG de dispositivo' },
  { value: 'software-rng', label: 'RNG de software' },
  { value: 'dice', label: 'Dados' },
  { value: 'coin', label: 'Moneda' },
  { value: 'cards', label: 'Cartas' },
  { value: 'unknown', label: 'Desconocido' },
];

function emptySource(kind: SourceKind): EntropySource {
  switch (kind) {
    case 'device-rng':
    case 'software-rng':
      return { kind, vendor: 'Desconocido' };
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
          <TextInput value={source.vendor} placeholder="Software" onChange={(vendor) => onChange({ ...source, vendor })} />
        </span>
      )}
      {(source.kind === 'dice' || source.kind === 'coin' || source.kind === 'cards') && (
        <span className={styles.rowGrow}>
          <input
            className={styles.input}
            type="number"
            min={1}
            placeholder="nº tiradas"
            value={source.count ?? ''}
            onChange={(e) => {
              const count = Number.parseInt(e.target.value, 10);
              onChange(Number.isFinite(count) && count > 0 ? { ...source, count } : { kind: source.kind });
            }}
          />
        </span>
      )}
      <button className={styles.iconButton} onClick={onRemove} disabled={!canRemove} aria-label="Quitar fuente">
        <X size={14} />
      </button>
    </li>
  );
}

/** Solo cómo es, nunca cuál es. */
const STRENGTH_OPTIONS = [
  { value: 'weak', label: 'Débil' },
  { value: 'phrase', label: 'Frase' },
  { value: 'random', label: 'Aleatoria larga' },
] as const;

const STRENGTH_HINT = {
  unset: 'Sin indicar: se trata como débil. Elige cómo es para que el análisis sea realista.',
  weak: 'Una palabra, un nombre o una fecha. Con la semilla en la mano, se adivina casi gratis.',
  phrase: 'Varias palabras elegidas por ti. Con la semilla, adivinarla exige mucho cómputo y algo de suerte.',
  random: 'Generada al azar y larga (p. ej. 6 o más palabras con dados). No se puede adivinar.',
} as const;

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
    ...model.devices.filter((d) => activeHolds(d).includes(id)).map((d) => ({ item: d.label, location: d.location, how: 'en memoria' })),
    ...model.artifacts
      .filter((a) => a.contents.some((c) => c.type === 'seed' && c.key === id))
      .map((a) => ({ item: a.label, location: a.location, how: 'frase semilla' })),
  ];

  return (
    <>
      <PanelHeader icon={KeyRound} kind="Key" title={key.label} />

      <Section>
        <Field label="Nombre">{(fid) => <TextInput id={fid} value={key.label} onChange={(label) => patch({ label }, 'label')} />}</Field>
        <Switch checked={key.passphrase} onChange={(passphrase) => patch({ passphrase })} label="Requiere passphrase" hint="Sin la passphrase, la semilla sola no sirve." />
        {key.passphrase && (
          <>
            <p className={styles.fieldTitle}>Cómo es la passphrase</p>
            <Segmented
              label="Cómo es la passphrase"
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

      <Section title="En la cartera">
        <div className={styles.twoCols}>
          <Field label="Fingerprint">
            {(fid) => (
              <TextInput id={fid} value={key.fingerprint ?? ''} placeholder="opcional" optional onChange={(v) => patch({ fingerprint: v || undefined }, 'fingerprint')} />
            )}
          </Field>
          <PathField key={`path:${id}`} value={key.derivation} onChange={(derivation) => patch({ derivation }, 'derivation')} />
        </div>
        <XpubField key={`xpub:${id}`} value={key.xpub} onChange={(xpub) => patch({ xpub }, 'xpub')} />
        <p className={styles.hint}>
          Opcional: con las xpubs de todas las keys, Esquema muestra el descriptor y la primera dirección. Más cómodo: importar el descriptor desde
          Esquema.
        </p>
      </Section>

      <Section title="Dónde está">
        {places.length === 0 && <p className={styles.hint}>En ningún sitio: si nadie la sabe de memoria, esta key está perdida.</p>}
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
        title="Entropía"
        action={
          <Button icon={Plus} onClick={() => setProvenance({ sources: [...sources, { kind: 'dice' }] })}>
            Fuente
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
        <p className={styles.hint}>Si mezclas varias fuentes, basta con que una sea buena… salvo que el dispositivo que las mezcla esté comprometido.</p>
        {sources.some((s) => s.kind === 'coin') && (
          <p className={styles.hint}>
            Hay varias formas de crear la semilla a mano con una moneda; una guía paso a paso es{' '}
            <a className={styles.link} href={SEMILLA_MONEDA_URL} target="_blank" rel="noopener noreferrer">
              semilla-moneda
            </a>
            , de Estudio Bitcoin.
          </p>
        )}
      </Section>

      <Section title="Generación">
        {isBlankProvenance(key) && carriers.length > 0 && (
          <div className={styles.suggestion}>
            <p>
              {carriers.length === 1 ? `Esta key está en ${carriers[0]!.label}. ¿Se generó ahí?` : 'Esta key está en varios dispositivos. ¿Se generó en alguno?'}
            </p>
            <div className={styles.buttonRow}>
              {carriers.map((d) => (
                <Button key={d.id} icon={Cpu} onClick={() => generateOn(d.id)}>
                  {carriers.length === 1 ? 'Sí, rellenar' : d.label}
                </Button>
              ))}
            </div>
            <p className={styles.hint}>Rellena la entropía (RNG del dispositivo) y el fabricante, modelo y firmware con que se generó.</p>
          </div>
        )}
        <Switch
          checked={!generatedBy}
          onChange={(manual) => setProvenance({ generatedBy: manual ? undefined : { vendor: 'Desconocido' } })}
          label="Calculada a mano"
          hint="Sin dispositivo ni software que haya derivado la semilla."
        />
        {generatedBy && (
          <>
            <Field label="Generada en">
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
                <Field label="Fabricante o software">
                  {(fid) => <TextInput id={fid} value={generatedBy.vendor} onChange={(vendor) => setProvenance({ generatedBy: { ...generatedBy, vendor } }, 'vendor')} />}
                </Field>
                <Field label="Nombre del modelo">
                  {(fid) => (
                    <TextInput id={fid} value={generatedBy.model ?? ''} placeholder="opcional" optional onChange={(v) => setProvenance({ generatedBy: { ...generatedBy, model: v || undefined } }, 'model')} />
                  )}
                </Field>
              </div>
            )}
            <Field label="Firmware con el que se generó">
              {(fid) => (
                <TextInput
                  optional
                  id={fid}
                  value={generatedBy.firmware ?? ''}
                  placeholder="p. ej. 5.6.0"
                  onChange={(v) => setProvenance({ generatedBy: { ...generatedBy, firmware: v || undefined } }, 'firmware')}
                />
              )}
            </Field>
            <p className={styles.hint}>Cuenta el firmware de cuando se generó la semilla, no el que tenga ahora el dispositivo.</p>
            <AdvisoryList matches={generatorAdvisories} />
          </>
        )}
        <Switch
          checked={independentlyVerified}
          onChange={(v) => setProvenance({ independentlyVerified: v })}
          label="Verificada de forma independiente"
          hint="Comprobaste con otra herramienta que la semilla sale de tu entropía (p. ej. tus tiradas de dados)."
        />
        {!hasOwnEntropy && (
          <p className={independentlyVerified ? styles.warningHint : styles.hint}>
            {independentlyVerified && <AlertTriangle size={12} aria-hidden />} Verificar solo protege si hay una fuente tuya (dados, moneda o cartas): demuestra que la
            semilla sale de esa entropía, no que la entropía sea buena. Si solo hay RNG (de un dispositivo, de un software o desconocido), un fallo en él la
            compromete igual.
          </p>
        )}
        {mixesRng && (
          <p className={independentlyVerified ? styles.warningHint : styles.hint}>
            {independentlyVerified && <AlertTriangle size={12} aria-hidden />} Mezclando un RNG con tus tiradas, normalmente no se puede verificar: la
            parte del RNG es secreta y otra herramienta no puede recalcularla. Para poder verificar, genera la frase semilla solo con tu entropía
            (dados o moneda) y recalcúlala en otra herramienta.
          </p>
        )}
      </Section>

      <DeleteButton
        label="Eliminar key"
        onClick={() => {
          apply((m) => removeKey(m, id));
          back();
        }}
        disabled={model.keys.length <= 1}
        reason="Tiene que haber al menos una key."
      />
    </>
  );
}
