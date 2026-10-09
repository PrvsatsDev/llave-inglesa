import { deriveAddress, formatDescriptor, isMultisigScript, looksLikeSeedWords, parseDescriptor, type ScriptType } from '@llave-inglesa/bitcoin';
import { flatPolicy, importDescriptor, indexModel, setWallet, walletDescriptor, walletOf, type CustodyModel, type Match } from '@llave-inglesa/domain';
import { AlertTriangle, Check, Copy, Eye, FileInput, X, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  descriptorProblemText,
  importProblemText,
  matchText,
  SCRIPT_TEXT,
  SEED_WORDS_TEXT,
  walletProblemText,
  walletWarningText,
} from '../lib/text.ts';
import { useDocument } from '../store/document.ts';
import { Button, Section, Segmented } from './inspector/fields.tsx';
import styles from './Wallet.module.css';

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };
  return (
    <Button icon={copied ? Check : Copy} onClick={copy} title={label}>
      {copied ? 'Copiado' : 'Copiar'}
    </Button>
  );
}

/**
 * Sección Esquema › Descriptor de la cartera: el descriptor que sale de las xpubs de las keys, la primera dirección para
 * comprobarlo contra la cartera, y la importación de un descriptor existente.
 */
export function WalletSection({ model }: { model: CustodyModel }) {
  const apply = useDocument((s) => s.apply);
  const result = useMemo(() => walletDescriptor(model), [model]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<Match[] | null>(null);
  const label = indexModel(model).label;
  const flat = flatPolicy(model);
  const wallet = walletOf(model);
  const hasXpubs = model.keys.some((k) => k.xpub !== undefined);

  const scripts: readonly ScriptType[] = flat?.kind === 'single' ? ['wpkh', 'sh-wpkh'] : ['wsh', 'sh-wsh'];

  return (
    <Section
      title="Descriptor de la cartera"
      action={
        flat && (
          <Button icon={FileInput} onClick={() => setImporting((v) => !v)}>
            Importar
          </Button>
        )
      }
    >
      {importing && (
        <ImportForm
          model={model}
          onCancel={() => setImporting(false)}
          onImport={(next, matches) => {
            apply(() => next);
            setImported(matches);
            setImporting(false);
          }}
        />
      )}
      {imported && <ImportReport matches={imported} label={label} onClose={() => setImported(null)} />}

      {!hasXpubs && !importing && (
        <p className={styles.hint}>
          Importa el descriptor que ya tienes (Sparrow, Nunchuk, Coldcard…) o pega la xpub en la ficha de cada key: se obtiene el descriptor
          y la primera dirección, para comprobar que coincide con tu cartera. No permite gastar, pero sí ver tu saldo.
        </p>
      )}

      {result.ok ? (
        <Descriptor descriptor={formatDescriptor(result.descriptor)} address={deriveAddress(result.descriptor, result.network)} testnet={result.network === 'testnet'} />
      ) : (
        hasXpubs && (
          <ul className={styles.problems}>
            {result.problems.map((p, i) => (
              <li key={i}>
                <XCircle size={14} aria-hidden />
                {walletProblemText(p, label)}
              </li>
            ))}
          </ul>
        )
      )}
      {result.ok &&
        result.warnings.map((w, i) => (
          <p key={i} className={styles.warning}>
            <AlertTriangle size={14} aria-hidden />
            {walletWarningText(w, label)}
          </p>
        ))}

      {flat && (
        <>
          <p className={styles.fieldTitle}>Tipo de dirección</p>
          <Segmented
            label="Tipo de dirección"
            value={wallet.script}
            options={scripts.map((s) => ({ value: s, label: SCRIPT_TEXT[s] }))}
            onChange={(script) => apply((m) => setWallet(m, { ...walletOf(m), script }))}
          />
          {isMultisigScript(wallet.script) && !wallet.sorted && (
            <p className={styles.hint}>Con multi (no sortedmulti) el orden de las keys importa: es el de la política.</p>
          )}
        </>
      )}
      {!flat && <p className={styles.hint}>La política tiene umbrales anidados: necesita Miniscript, que todavía no se escribe.</p>}

      {hasXpubs && (
        <p className={styles.privacy}>
          <Eye size={14} aria-hidden />
          Con las xpubs, este documento deja ver tu saldo y todos tus movimientos. Guárdalo cifrado.
        </p>
      )}
    </Section>
  );
}

function Descriptor({ descriptor, address, testnet }: { descriptor: string; address: string; testnet: boolean }) {
  return (
    <div className={styles.result}>
      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <span className={styles.fieldTitle}>Descriptor{testnet && <span className={styles.badge}>testnet</span>}</span>
          <CopyButton value={descriptor} label="Copiar el descriptor" />
        </div>
        <p className={styles.mono} data-testid="descriptor">
          {descriptor}
        </p>
      </div>
      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <span className={styles.fieldTitle}>Primera dirección de recepción</span>
          <CopyButton value={address} label="Copiar la dirección" />
        </div>
        <p className={`${styles.mono} ${styles.address}`} data-testid="primera-direccion">
          {address}
        </p>
        <p className={styles.hint}>
          Compárala con la primera dirección de recepción de tu cartera (o la que muestra tu dispositivo). Si coincide, el descriptor es el
          bueno.
        </p>
      </div>
    </div>
  );
}

function ImportForm({ model, onImport, onCancel }: { model: CustodyModel; onImport(next: CustodyModel, matches: Match[]): void; onCancel(): void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const label = indexModel(model).label;

  const submit = () => {
    if (looksLikeSeedWords(text)) {
      setText('');
      setError(SEED_WORDS_TEXT);
      return;
    }
    const parsed = parseDescriptor(text);
    if (!parsed.ok) {
      // Una clave privada no se queda ni en el cuadro de texto.
      if (parsed.problem.code === 'private-key') setText('');
      setError(descriptorProblemText(parsed.problem));
      return;
    }
    const r = importDescriptor(model, parsed.value);
    if (!r.ok) {
      setError(importProblemText(r.problem, label));
      return;
    }
    onImport(r.model, r.matches);
  };

  return (
    <div className={styles.importForm}>
      <textarea
        className={styles.textarea}
        value={text}
        rows={5}
        aria-label="Descriptor a importar"
        placeholder="wsh(sortedmulti(2,[a1b2c3d4/48h/0h/0h/2h]xpub…/<0;1>/*,…))#…"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
      />
      {error && (
        <p className={styles.error} role="alert">
          <XCircle size={14} aria-hidden />
          {error}
        </p>
      )}
      <p className={styles.hint}>Solo la parte pública: xpubs, fingerprints y derivaciones. Nunca palabras ni claves privadas.</p>
      <div className={styles.buttons}>
        <Button variant="primary" icon={FileInput} onClick={submit} disabled={text.trim() === ''}>
          Importar descriptor
        </Button>
        <Button icon={X} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function ImportReport({ matches, label, onClose }: { matches: Match[]; label: (id: string) => string; onClose(): void }) {
  const byOrder = matches.some((m) => m.by === 'order');
  return (
    <div className={byOrder ? styles.warningBox : styles.okBox} role="status">
      <div className={styles.blockHeader}>
        <span>
          {byOrder ? <AlertTriangle size={14} aria-hidden /> : <Check size={14} aria-hidden />} Importado: {matches.map((m) => matchText(m, label)).join('; ')}.
        </span>
        <button className={styles.close} onClick={onClose} aria-label="Cerrar">
          <X size={14} />
        </button>
      </div>
      {byOrder && (
        <p>
          Las emparejadas por orden pueden no ser la key que crees: comprueba en la ficha de cada una que el fingerprint es el de su dispositivo
          o su backup, o corrige los nombres.
        </p>
      )}
    </div>
  );
}
