import { deriveAddress, formatDescriptor, type Descriptor, type Network } from '@llave-inglesa/bitcoin';
import { addArtifact, flatPolicy, indexModel, updateArtifact, type CustodyModel, type SecretRef } from '@llave-inglesa/domain';
import { Check, Plus, Printer, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { UI, walletKindText } from '../lib/text.ts';
import { useDocument } from '../store/document.ts';
import { Button, Select } from './inspector/fields.tsx';
import { qrMatrix } from '../lib/qr.ts';
import { Qr } from './Qr.tsx';
import styles from './PrintSheet.module.css';

/** Caracteres por línea del descriptor en papel: líneas numeradas para no perderse al copiarlo a mano. */
const LINE = 44;
/** Direcciones de recepción que se listan para comprobar. */
const ADDRESSES = 3;

const T = UI.hojaDescriptor;

const chunk = (s: string, n: number) => Array.from({ length: Math.ceil(s.length / n) }, (_, i) => s.slice(i * n, (i + 1) * n));

/**
 * El descriptor como documento para imprimir o guardar como PDF (con el diálogo de impresión del navegador: sin red ni
 * librerías de PDF). Se abre a pantalla completa; al imprimir solo sale la hoja.
 */
export function DescriptorPrint({ model, descriptor, network, onClose }: { model: CustodyModel; descriptor: Descriptor; network: Network; onClose(): void }) {
  const text = useMemo(() => formatDescriptor(descriptor), [descriptor]);
  const matrix = useMemo(() => qrMatrix(text), [text]);
  const addresses = useMemo(() => Array.from({ length: ADDRESSES }, (_, i) => deriveAddress(descriptor, network, 0, i)), [descriptor, network]);
  const label = indexModel(model).label;
  const flat = flatPolicy(model)!;
  const ids = flat.kind === 'single' ? [flat.key] : flat.keys;
  const multisig = descriptor.threshold !== undefined;
  const today = UI.comun.fecha(new Date());

  // Esc cierra la hoja (antes que el "volver" global de la aplicación).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div className={`${styles.overlay} print-root`} role="dialog" aria-modal="true" aria-label={T.nombre}>
      <div className={styles.toolbar}>
        <Button variant="primary" icon={Printer} onClick={() => window.print()}>
          {UI.comun.imprimir}
        </Button>
        <Button icon={X} onClick={onClose}>
          {UI.comun.cerrar}
        </Button>
      </div>
      <AddToScheme model={model} keys={ids} />

      <article className={styles.sheet}>
        <header className={styles.header}>
          <h1>{T.titulo}</h1>
          <p className={styles.meta}>
            <strong>{model.name}</strong> · {walletKindText(descriptor, network)}
          </p>
          <p className={styles.meta}>{T.generado(today)}</p>
        </header>

        <p className={styles.intro}>
          {multisig
            ? T.introMultisig
            : T.introSingle}{' '}
          <strong>{T.noGasta}</strong>
        </p>

        <section className={styles.descriptor}>
          {matrix && (
            <figure className={styles.qr}>
              <Qr matrix={matrix} size={220} label={T.qr} />
              <figcaption>{T.escanealo}</figcaption>
            </figure>
          )}
          <div className={styles.text}>
            <h2>{T.descriptor}</h2>
            <ol className={styles.lines} data-testid="descriptor-lineas">
              {chunk(text, LINE).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
            <p className={styles.note}>{T.todoSeguido(text.split('#')[1] ?? '')}</p>
          </div>
        </section>

        <section>
          <h2>{T.keys}</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{T.columnas.key}</th>
                <th>{T.columnas.fingerprint}</th>
                <th>{T.columnas.derivacion}</th>
                <th>{T.columnas.xpub}</th>
              </tr>
            </thead>
            <tbody>
              {descriptor.keys.map((k, i) => (
                <tr key={i}>
                  <td>{label(ids[i]!)}</td>
                  <td className={styles.mono}>{k.fingerprint ?? '—'}</td>
                  <td className={styles.mono}>{k.path ? `m/${k.path}` : '—'}</td>
                  <td className={`${styles.mono} ${styles.xpub}`}>{k.xpub}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>{T.direcciones}</h2>
          <ol className={styles.addresses} start={0}>
            {addresses.map((a) => (
              <li key={a} className={styles.mono}>
                {a}
              </li>
            ))}
          </ol>
          <p className={styles.note}>{T.compruebaDireccion}</p>
        </section>

        <footer className={styles.footer}>{T.pie}</footer>
      </article>
    </div>,
    document.body,
  );
}

/** Distinto del «Descriptor impreso» que se crea a mano, para saber de dónde salió cada copia. */
const PRINTED_LABEL = T.nombreBackup;

/** Imprimirlo crea un backup más: se ofrece añadirlo al esquema para que el análisis sepa dónde está y quién lo puede ver. */
function AddToScheme({ model, keys }: { model: CustodyModel; keys: readonly string[] }) {
  const apply = useDocument((s) => s.apply);
  const [location, setLocation] = useState(model.locations[0]!.id);
  const [added, setAdded] = useState<string | null>(null);
  const label = indexModel(model).label;
  const add = () => {
    apply((m) => {
      const r = addArtifact(m, location);
      // Las xpubs ya van en el descriptor (el motor las deduce de él); se apuntan también para que se vean en el mapa.
      const contents: SecretRef[] = [{ type: 'descriptor' }, ...keys.map((key): SecretRef => ({ type: 'xpub', key }))];
      return updateArtifact(r.model, r.id, { label: PRINTED_LABEL, medium: 'paper', contents });
    });
    setAdded(label(location));
  };
  return (
    <aside className={styles.aside}>
      {added ? (
        <p>
          <Check size={14} aria-hidden /> {T.anadido(PRINTED_LABEL, added)}
        </p>
      ) : (
        <>
          <p>{T.otroBackup}</p>
          <div className={styles.asideRow}>
            <Select
              value={location}
              options={model.locations.map((l) => ({ value: l.id, label: label(l.id) }))}
              onChange={setLocation}
            />
            <Button icon={Plus} onClick={add}>
              {T.anadir}
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
