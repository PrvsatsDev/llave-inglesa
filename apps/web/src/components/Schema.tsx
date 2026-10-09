import { addArtifact, addDevice, addKey, addLocation, addPerson, indexModel, setThreshold, updateMeta, type CustodyModel, type Id } from '@llave-inglesa/domain';
import { AlertTriangle, BadgeCheck, Brain, ChevronRight, Cpu, Crown, MapPin, Plus, RectangleHorizontal, User, UserPlus, X, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildGraph, type LocationNode, type PersonNode } from '../graph/build.ts';
import { ITEM_ICONS, locationIcon, locationMeta } from '../graph/LocationNode.tsx';
import { ROLE } from '../graph/PersonNode.tsx';
import { SecretBadge } from '../graph/SecretBadge.tsx';
import { keyColor } from '../lib/key-colors.ts';
import { issueText, PASSPHRASE_STRENGTH_TEXT, plural, provenanceText, UI } from '../lib/text.ts';
import { useValidation } from '../lib/validation.ts';
import { useDocument } from '../store/document.ts';
import { useSelection, type Selection } from '../store/selection.ts';
import { Button, Field, Section, Segmented, Select, TextArea, TextInput } from './inspector/fields.tsx';
import { KeyChip } from './KeyChip.tsx';
import { WalletSection } from './Wallet.tsx';
import styles from './Schema.module.css';

const T = UI.esquema;
const SIN_NOMBRE = UI.comun.sinNombre;

/** Sección Esquema: problemas (si los hay), política, keys y el índice de todo lo que hay y dónde. */
export function Schema({ model }: { model: CustodyModel }) {
  const apply = useDocument((s) => s.apply);
  const select = useSelection((s) => s.select);

  const create = (make: (m: CustodyModel) => { model: CustodyModel; id: string }, kind: Selection['kind']) => {
    let id = '';
    apply((m) => {
      const r = make(m);
      id = r.id;
      return r.model;
    });
    select({ kind, id });
  };

  const policy = model.policy;
  const n = policy.type === 'thresh' ? policy.of.length : 1;

  return (
    <>
      {model.description && (
        <Section title={T.sobre}>
          <p className={styles.description}>{model.description}</p>
        </Section>
      )}
      <Problems model={model} />

      <Section title={T.politica}>
        {policy.type === 'thresh' ? (
          <>
            <Segmented
              label={T.firmasNecesarias}
              value={String(policy.k)}
              options={Array.from({ length: n }, (_, i) => ({ value: String(i + 1), label: T.kDeN(i + 1, n) }))}
              onChange={(k) => apply((m) => setThreshold(m, Number(k)))}
            />
            <p className={styles.hint}>{T.pistaFirmas}</p>
          </>
        ) : (
          <p className={styles.hint}>{T.singleSig}</p>
        )}
      </Section>

      <Section title={T.keys(model.keys.length)} action={<Button icon={Plus} onClick={() => create(addKey, 'key')}>{T.key}</Button>}>
        <ul className={styles.list}>
          {model.keys.map((k) => (
            <li key={k.id}>
              <button className={styles.row} onClick={() => select({ kind: 'key', id: k.id })}>
                <span className={styles.rowMain}>
                  <KeyChip label={k.label} color={keyColor(model, k.id)} />
                  {k.passphrase && <span className={styles.badge}>{T.conPassphrase(k.passphraseStrength ? PASSPHRASE_STRENGTH_TEXT[k.passphraseStrength] : T.sinIndicar)}</span>}
                  {k.xpub && (
                    <span className={styles.badge} title={T.pistaXpub}>
                      {T.xpub}
                    </span>
                  )}
                  {k.provenance.independentlyVerified && (
                    <span className={`${styles.badge} ${styles.verified}`} title={T.pistaVerificada}>
                      <BadgeCheck size={12} aria-hidden /> {T.verificada}
                    </span>
                  )}
                </span>
                <span className={styles.rowSub}>{provenanceText(k)}</span>
                <ChevronRight size={14} className={styles.chevron} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <WalletSection model={model} />

      <Places
        model={model}
        onAdd={() => create((m) => addLocation(m), 'location')}
        onAddItem={(kind, location) =>
          kind === 'artifact' ? create((m) => addArtifact(m, location), 'artifact') : create((m) => addDevice(m, location, kind), 'device')
        }
      />
      <People model={model} onAdd={() => create((m) => addPerson(m), 'person')} />

      <details className={styles.meta}>
        <summary>{T.nombreYDescripcion}</summary>
        <div className={styles.metaBody}>
          <Field label={T.nombre}>
            {(id) => <TextInput id={id} value={model.name} onChange={(name) => apply((m) => updateMeta(m, { name }), 'meta:name')} />}
          </Field>
          <Field label={T.descripcion}>
            {(id) => (
              <TextArea
                id={id}
                value={model.description ?? ''}
                placeholder={T.pistaDescripcion}
                onChange={(description) => apply((m) => updateMeta(m, { description: description || undefined }), 'meta:description')}
              />
            )}
          </Field>
        </div>
      </details>
    </>
  );
}

/** Errores y avisos del modelo, arriba del todo; si no hay ninguno, no ocupa sitio. */
function Problems({ model }: { model: CustodyModel }) {
  const { valid, issues } = useValidation(model);
  if (issues.length === 0) return null;
  const label = indexModel(model).label;
  return (
    <Section title={valid ? T.avisos : T.errores}>
      <ul className={styles.issues}>
        {issues.map((i, n) => (
          <li key={n} className={i.severity === 'error' ? styles.error : styles.warning}>
            {i.severity === 'error' ? <XCircle size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
            {issueText(i, label)}
          </li>
        ))}
      </ul>
      {!valid && <p className={styles.hint}>{T.analisisEnPausa}</p>}
    </Section>
  );
}

const useGraph = (model: CustodyModel) => useMemo(() => buildGraph(model), [model]);

type ItemKind = 'stateful' | 'stateless' | 'artifact';

const ITEM_KINDS = (['stateful', 'stateless', 'artifact'] as const).map((value) => ({ value, label: T.tiposElemento[value] }));

/** Formulario para añadir un dispositivo o backup: qué y dónde. */
interface Adding {
  kind: ItemKind;
  location: Id;
  /** Abierto desde el "+" de una ubicación (se muestra debajo de ella) o desde la cabecera. */
  fromRow: boolean;
}

/** Índice de ubicaciones con lo que hay en cada una, como en el mapa. */
function Places({ model, onAdd, onAddItem }: { model: CustodyModel; onAdd(): void; onAddItem(kind: ItemKind, location: Id): void }) {
  const select = useSelection((s) => s.select);
  const locations = useGraph(model).nodes.filter((n): n is LocationNode => n.type === 'location');
  const [adding, setAdding] = useState<Adding | null>(null);
  const label = indexModel(model).label;
  // Si la ubicación elegida desaparece (deshacer, eliminarla…), el formulario se cierra.
  const current = adding && model.locations.some((l) => l.id === adding.location) ? adding : null;
  const startFromHeader = (kind: ItemKind) => setAdding({ kind, location: current?.location ?? model.locations[0]!.id, fromRow: false });

  const form = current && (
    <div className={styles.addForm}>
      <Segmented label={T.queAnadir} value={current.kind} options={ITEM_KINDS} onChange={(kind) => setAdding({ ...current, kind })} />
      {!current.fromRow && (
        <Field label={T.donde}>
          {(id) => (
            <Select
              id={id}
              value={current.location}
              options={model.locations.map((l) => ({ value: l.id, label: label(l.id) }))}
              onChange={(location) => setAdding({ ...current, location })}
            />
          )}
        </Field>
      )}
      <div className={styles.addButtons}>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => {
            onAddItem(current.kind, current.location);
            setAdding(null);
          }}
        >
          {UI.comun.anadir}
        </Button>
        <Button icon={X} onClick={() => setAdding(null)}>
          {UI.comun.cancelar}
        </Button>
      </div>
    </div>
  );

  return (
    <Section
      title={T.ubicaciones(locations.length)}
      action={
        <span className={styles.actions}>
          <Button icon={MapPin} onClick={onAdd}>{T.ubicacion}</Button>
          <Button icon={Cpu} onClick={() => startFromHeader('stateful')}>{T.dispositivo}</Button>
          <Button icon={RectangleHorizontal} onClick={() => startFromHeader('artifact')}>{T.backup}</Button>
        </span>
      }
    >
      {current && !current.fromRow && form}
      <ul className={styles.list}>
        {locations.map(({ id, data }) => {
          const Icon = locationIcon(data);
          const meta = locationMeta(data);
          return (
            <li key={id} className={styles.place}>
              <button
                className={styles.addHere}
                onClick={() => setAdding(current?.fromRow && current.location === id ? null : { kind: current?.kind ?? 'stateful', location: id, fromRow: true })}
                aria-label={T.anadirEn(data.name || null)}
                aria-expanded={current?.fromRow === true && current.location === id}
                title={T.pistaAnadirAqui}
              >
                <Plus size={14} aria-hidden />
              </button>
              <button className={`${styles.row} ${styles.placeRow}`} onClick={() => select({ kind: 'location', id })}>
                <span className={styles.rowMain}>
                  <Icon size={14} className={styles.icon} aria-hidden />
                  <span className={styles.name}>{data.name || SIN_NOMBRE}</span>
                  <span className={styles.keys}>
                    {data.keys.map((k) => (
                      <KeyChip key={k.id} label={k.label} color={k.color} size="sm" />
                    ))}
                  </span>
                </span>
                {(meta || data.items.length === 0) && <span className={styles.rowSub}>{[meta, data.items.length === 0 && T.vacia].filter(Boolean).join(' · ')}</span>}
                <ChevronRight size={14} className={styles.chevron} aria-hidden />
              </button>
              {current?.fromRow && current.location === id && form}
              {data.items.length > 0 && (
                <ul className={styles.items}>
                  {data.items.map((item) => {
                    const ItemIcon = ITEM_ICONS[item.icon];
                    return (
                      <li key={item.id}>
                        <button className={`${styles.row} ${styles.item}`} onClick={() => select({ kind: item.kind, id: item.id })}>
                          <span className={styles.rowMain}>
                            <ItemIcon size={13} className={styles.icon} aria-hidden />
                            <span className={styles.name}>{item.label || SIN_NOMBRE}</span>
                            <span className={styles.secrets}>
                              {item.badges.map((b, i) => (
                                <SecretBadge key={i} badge={b} />
                              ))}
                            </span>
                          </span>
                          <ChevronRight size={14} className={styles.chevron} aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Índice de personas: su papel, a cuántos sitios puede entrar y qué sabe de memoria. */
function People({ model, onAdd }: { model: CustodyModel; onAdd(): void }) {
  const select = useSelection((s) => s.select);
  const people = useGraph(model).nodes.filter((n): n is PersonNode => n.type === 'person');
  const entries = (id: string) => model.locations.filter((l) => l.access.some((a) => a.person === id)).length;
  return (
    <Section title={T.personas(people.length)} action={<Button icon={UserPlus} onClick={onAdd}>{T.persona}</Button>}>
      <ul className={styles.list}>
        {people.map(({ id, data }) => {
          const Avatar = data.role === 'owner' ? Crown : User;
          return (
            <li key={id}>
              <button className={styles.row} onClick={() => select({ kind: 'person', id })}>
                <span className={styles.rowMain}>
                  <Avatar size={14} className={styles.icon} aria-hidden />
                  <span className={styles.name}>{data.name || SIN_NOMBRE}</span>
                  <span className={styles.role}>{ROLE[data.role]}</span>
                </span>
                <span className={styles.rowSub}>
                  {entries(id) ? T.entraEn(plural(entries(id), ...T.ubicacionesPlural)) : T.noEntra}
                  {data.knows.length > 0 && (
                    <span className={styles.secrets}>
                      <Brain size={12} aria-label={T.sabeDeMemoria} />
                      {data.knows.map((b, i) => (
                        <SecretBadge key={i} badge={b} withDevice />
                      ))}
                    </span>
                  )}
                </span>
                <ChevronRight size={14} className={styles.chevron} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
