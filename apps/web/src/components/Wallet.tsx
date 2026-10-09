import { deriveAddress, formatDescriptor, isMultisigScript, looksLikeSeedWords, parseDescriptor, type ScriptType } from '@llave-inglesa/bitcoin';
import { flatPolicy, importDescriptor, indexModel, setWallet, walletDescriptor, walletOf, type CustodyModel, type Match } from '@llave-inglesa/domain';
import { AlertTriangle, Check, Copy, Eye, FileInput, Printer, X, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  descriptorProblemText,
  importProblemText,
  matchText,
  SCRIPT_TEXT,
  SEED_WORDS_TEXT,
  UI,
  walletProblemText,
  walletWarningText,
} from '../lib/text.ts';
import { useDocument } from '../store/document.ts';
import { DescriptorPrint } from './DescriptorPrint.tsx';
import { Button, Section, Segmented } from './inspector/fields.tsx';
import styles from './Wallet.module.css';

const T = UI.descriptor;

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
      {copied ? T.copiado : UI.comun.copiar}
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
  const [printing, setPrinting] = useState(false);
  const label = indexModel(model).label;
  const flat = flatPolicy(model);
  const wallet = walletOf(model);
  const hasXpubs = model.keys.some((k) => k.xpub !== undefined);

  const scripts: readonly ScriptType[] = flat?.kind === 'single' ? ['wpkh', 'sh-wpkh'] : ['wsh', 'sh-wsh'];

  return (
    <Section
      title={T.titulo}
      action={
        flat && (
          <Button icon={FileInput} onClick={() => setImporting((v) => !v)}>
            {T.importar}
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
        <p className={styles.hint}>{T.pistaSinXpubs}</p>
      )}

      {result.ok ? (
        <>
          <Descriptor descriptor={formatDescriptor(result.descriptor)} address={deriveAddress(result.descriptor, result.network)} testnet={result.network === 'testnet'} />
          <Button icon={Printer} onClick={() => setPrinting(true)}>
            {T.imprimir}
          </Button>
          {printing && <DescriptorPrint model={model} descriptor={result.descriptor} network={result.network} onClose={() => setPrinting(false)} />}
        </>
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
          <p className={styles.fieldTitle}>{T.tipoDireccion}</p>
          <Segmented
            label={T.tipoDireccion}
            value={wallet.script}
            options={scripts.map((s) => ({ value: s, label: SCRIPT_TEXT[s] }))}
            onChange={(script) => apply((m) => setWallet(m, { ...walletOf(m), script }))}
          />
          {isMultisigScript(wallet.script) && !wallet.sorted && (
            <p className={styles.hint}>{T.ordenImporta}</p>
          )}
        </>
      )}
      {!flat && <p className={styles.hint}>{T.anidados}</p>}

      {hasXpubs && (
        <p className={styles.privacy}>
          <Eye size={14} aria-hidden />
          {T.privacidad}
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
          <span className={styles.fieldTitle}>
            {T.descriptor}
            {testnet && <span className={styles.badge}>{T.testnet}</span>}
          </span>
          <CopyButton value={descriptor} label={T.copiarDescriptor} />
        </div>
        <p className={styles.mono} data-testid="descriptor">
          {descriptor}
        </p>
      </div>
      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <span className={styles.fieldTitle}>{T.primeraDireccion}</span>
          <CopyButton value={address} label={T.copiarDireccion} />
        </div>
        <p className={`${styles.mono} ${styles.address}`} data-testid="primera-direccion">
          {address}
        </p>
        <p className={styles.hint}>{T.pistaDireccion}</p>
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
        aria-label={T.aImportar}
        placeholder={T.ejemplo}
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
      <p className={styles.hint}>{T.soloPublico}</p>
      <div className={styles.buttons}>
        <Button variant="primary" icon={FileInput} onClick={submit} disabled={text.trim() === ''}>
          {T.importarDescriptor}
        </Button>
        <Button icon={X} onClick={onCancel}>
          {UI.comun.cancelar}
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
          {byOrder ? <AlertTriangle size={14} aria-hidden /> : <Check size={14} aria-hidden />} {T.importado(matches.map((m) => matchText(m, label)))}
        </span>
        <button className={styles.close} onClick={onClose} aria-label={UI.comun.cerrar}>
          <X size={14} />
        </button>
      </div>
      {byOrder && (
        <p>{T.porOrden}</p>
      )}
    </div>
  );
}
