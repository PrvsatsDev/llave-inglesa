import { activeHolds, indexModel, removeKey, updateKey, type CustodyModel, type EntropySource, type Key, type Provenance } from '@llave-inglesa/domain';
import { KeyRound, MapPin, Plus, X } from 'lucide-react';
import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { Button, DeleteButton, Field, PanelHeader, Section, Select, Switch, TextInput } from './fields.tsx';
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
      {(source.kind === 'device-rng' || source.kind === 'software-rng') && (
        <span className={styles.rowGrow}>
          <TextInput value={source.vendor} placeholder="Fabricante" onChange={(vendor) => onChange({ ...source, vendor })} />
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

export function KeyInspector({ model, keyEntity: key }: { model: CustodyModel; keyEntity: Key }) {
  const apply = useDocument((s) => s.apply);
  const select = useSelection((s) => s.select);
  const id = key.id;
  const patch = (p: Partial<Key>, field?: string) => apply((m) => updateKey(m, id, p), field && `key:${id}:${field}`);
  const setProvenance = (p: Partial<Provenance>, field?: string) => patch({ provenance: { ...key.provenance, ...p } }, field && `provenance:${field}`);
  const { sources, generatedBy, independentlyVerified } = key.provenance;

  const index = indexModel(model);
  const places = [
    ...model.devices.filter((d) => activeHolds(d).includes(id)).map((d) => ({ item: d.label, location: d.location, how: 'en memoria' })),
    ...model.artifacts
      .filter((a) => a.contents.some((c) => c.type === 'seed' && c.key === id))
      .map((a) => ({ item: a.label, location: a.location, how: 'semilla' })),
  ];

  return (
    <>
      <PanelHeader icon={KeyRound} kind="Key" title={key.label} onClose={() => select(null)} />

      <Section>
        <div className={styles.twoCols}>
          <Field label="Nombre">{(fid) => <TextInput id={fid} value={key.label} onChange={(label) => patch({ label }, 'label')} />}</Field>
          <Field label="Fingerprint">
            {(fid) => (
              <TextInput id={fid} value={key.fingerprint ?? ''} placeholder="opcional" onChange={(v) => patch({ fingerprint: v || undefined }, 'fingerprint')} />
            )}
          </Field>
        </div>
        <Switch checked={key.passphrase} onChange={(passphrase) => patch({ passphrase })} label="Requiere passphrase" hint="Sin la passphrase, la semilla sola no sirve." />
      </Section>

      <Section title="Dónde está">
        {places.length === 0 && <p className={styles.hint}>En ningún sitio: si nadie la sabe de memoria, esta key está perdida.</p>}
        <ul className={styles.list}>
          {places.map((p, i) => (
            <li key={i}>
              <button className={styles.rowButton} onClick={() => select({ kind: 'location', id: p.location })}>
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
        <Switch
          checked={!generatedBy}
          onChange={(manual) => setProvenance({ generatedBy: manual ? undefined : { vendor: 'Desconocido' } })}
          label="Calculada a mano"
          hint="Sin dispositivo ni software que haya derivado la semilla."
        />
        {generatedBy && (
          <div className={styles.twoCols}>
            <Field label="Generada en (fabricante)">
              {(fid) => <TextInput id={fid} value={generatedBy.vendor} onChange={(vendor) => setProvenance({ generatedBy: { ...generatedBy, vendor } }, 'vendor')} />}
            </Field>
            <Field label="Modelo">
              {(fid) => (
                <TextInput id={fid} value={generatedBy.model ?? ''} placeholder="opcional" onChange={(v) => setProvenance({ generatedBy: { ...generatedBy, model: v || undefined } }, 'model')} />
              )}
            </Field>
          </div>
        )}
        <Switch
          checked={independentlyVerified}
          onChange={(v) => setProvenance({ independentlyVerified: v })}
          label="Verificada de forma independiente"
          hint="Comprobaste con otra herramienta que la semilla sale de tu entropía (p. ej. tus tiradas de dados)."
        />
      </Section>

      <DeleteButton
        label="Eliminar key"
        onClick={() => {
          apply((m) => removeKey(m, id));
          select(null);
        }}
        disabled={model.keys.length <= 1}
        reason="Tiene que haber al menos una key."
      />
    </>
  );
}
