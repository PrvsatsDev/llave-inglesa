import { deriveAddress, formatDescriptor, type Descriptor, type Network } from '@llave-inglesa/bitcoin';
import { addArtifact, flatPolicy, indexModel, updateArtifact, type CustodyModel, type SecretRef } from '@llave-inglesa/domain';
import { Check, Plus, Printer, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { walletKindText } from '../lib/text.ts';
import { useDocument } from '../store/document.ts';
import { Button, Select } from './inspector/fields.tsx';
import { qrMatrix } from '../lib/qr.ts';
import { Qr } from './Qr.tsx';
import styles from './PrintSheet.module.css';

/** Caracteres por línea del descriptor en papel: líneas numeradas para no perderse al copiarlo a mano. */
const LINE = 44;
/** Direcciones de recepción que se listan para comprobar. */
const ADDRESSES = 3;

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
  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

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
    <div className={`${styles.overlay} print-root`} role="dialog" aria-modal="true" aria-label="Descriptor para imprimir">
      <div className={styles.toolbar}>
        <Button variant="primary" icon={Printer} onClick={() => window.print()}>
          Imprimir o guardar como PDF
        </Button>
        <Button icon={X} onClick={onClose}>
          Cerrar
        </Button>
      </div>
      <AddToScheme model={model} keys={ids} />

      <article className={styles.sheet}>
        <header className={styles.header}>
          <h1>Descriptor de la cartera</h1>
          <p className={styles.meta}>
            <strong>{model.name}</strong> · {walletKindText(descriptor, network)}
          </p>
          <p className={styles.meta}>Generado el {today}</p>
        </header>

        <p className={styles.intro}>
          {multisig
            ? 'La configuración pública de la cartera: qué keys la forman y cuántas firmas hacen falta. En un multisig las semillas solas no bastan para recuperarla: hacen falta las xpubs de todas las keys, y están aquí.'
            : 'La configuración pública de la cartera. Con la semilla basta para recuperarla, pero este papel dice qué tipo de dirección y qué derivación usa, para encontrar los fondos a la primera.'}{' '}
          <strong>No permite gastar, pero quien lo tenga ve el saldo y todos los movimientos.</strong>
        </p>

        <section className={styles.descriptor}>
          {matrix && (
            <figure className={styles.qr}>
              <Qr matrix={matrix} size={220} label="QR del descriptor" />
              <figcaption>Escanéalo al importar la cartera</figcaption>
            </figure>
          )}
          <div className={styles.text}>
            <h2>Descriptor</h2>
            <ol className={styles.lines} data-testid="descriptor-lineas">
              {chunk(text, LINE).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
            <p className={styles.note}>
              Todo seguido, sin espacios ni saltos de línea. La suma de control del final (#{text.split('#')[1]}) detecta cualquier error al copiarlo
              a mano.
            </p>
          </div>
        </section>

        <section>
          <h2>Keys</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Key</th>
                <th>Fingerprint</th>
                <th>Derivación</th>
                <th>Xpub</th>
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
          <h2>Primeras direcciones de recepción</h2>
          <ol className={styles.addresses} start={0}>
            {addresses.map((a) => (
              <li key={a} className={styles.mono}>
                {a}
              </li>
            ))}
          </ol>
          <p className={styles.note}>Al restaurar la cartera, comprueba que la primera coincide: si es así, el descriptor está bien copiado.</p>
        </section>

        <footer className={styles.footer}>Solo datos públicos: ni palabras ni claves privadas. Generado sin conexión con llave-inglesa.</footer>
      </article>
    </div>,
    document.body,
  );
}

/** Distinto del «Descriptor impreso» que se crea a mano, para saber de dónde salió cada copia. */
const PRINTED_LABEL = 'PDF con descriptor';

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
          <Check size={14} aria-hidden /> Añadido «{PRINTED_LABEL}» en {added}: el análisis ya lo tiene en cuenta.
        </p>
      ) : (
        <>
          <p>Una copia impresa es un backup más. ¿Dónde la vas a guardar? Añádela al esquema para que el análisis sepa quién puede verla.</p>
          <div className={styles.asideRow}>
            <Select
              value={location}
              options={model.locations.map((l) => ({ value: l.id, label: label(l.id) }))}
              onChange={setLocation}
            />
            <Button icon={Plus} onClick={add}>
              Añadir al esquema
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
