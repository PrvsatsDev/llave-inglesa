import { indexModel, type CustodyModel } from '@llave-inglesa/domain';
import { attackEffort } from '@llave-inglesa/engine';
import { Flame, Hourglass, Skull } from 'lucide-react';
import type { ReactNode } from 'react';
import { attackText, lossText } from '../lib/text.ts';
import { useAnalysis } from '../store/analysis.ts';
import { Section } from './inspector/fields.tsx';
import styles from './Findings.module.css';

const MAX_SHOWN = 5;

function CutList<A>({ cuts, total, text, meta, empty, tone = 'danger' }: {
  cuts: A[][];
  tone?: 'danger' | 'warn';
  total: number;
  text(a: A): string;
  meta?(cut: A[]): ReactNode;
  empty: string;
}) {
  if (cuts.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <>
      <ul className={styles.list}>
        {cuts.slice(0, MAX_SHOWN).map((cut, i) => (
          <li key={i} className={`${styles.cut} ${styles[tone]}`}>
            {cut.map((atom, j) => (
              <span key={j} className={styles.atomWrap}>
                {j > 0 && <span className={styles.plus}>+</span>}
                <span className={styles.atom}>{text(atom)}</span>
              </span>
            ))}
            {meta && <span className={styles.meta}>{meta(cut)}</span>}
          </li>
        ))}
      </ul>
      {total > MAX_SHOWN && <p className={styles.more}>{total} combinaciones mínimas en total</p>}
    </>
  );
}

/** Los puntos débiles que ha encontrado el análisis. */
export function Findings({ model }: { model: CustodyModel }) {
  const analysis = useAnalysis((s) => s.analysis);
  if (!analysis) return null;
  const label = indexModel(model).label;
  const { security, resilience } = analysis;
  // Las vías "casi igual de baratas" también cuentan para la puntuación: se muestran todas.
  const cheapThefts = security.minEffort === null ? [] : security.cuts.slice(0, security.cheapRoutes);

  return (
    <>
      <Section title="Formas más baratas de robar">
        <div className={styles.header}>
          <Skull size={14} aria-hidden />
          <span>Cualquiera de estas combinaciones basta para gastar tus fondos. El esfuerzo suma lo difícil que es cada ataque.</span>
        </div>
        <CutList
          cuts={cheapThefts}
          total={security.cuts.length}
          text={(a) => attackText(a, label)}
          meta={(cut) => `esfuerzo ${attackEffort(cut).toLocaleString('es')}`}
          empty={`Ninguna combinación de hasta ${security.searchedUpTo} ataques lo consigue.`}
        />
      </Section>
      <Section title="Formas más baratas de perderlo todo">
        <div className={styles.header}>
          <Flame size={14} aria-hidden />
          <span>Tras cualquiera de estas, nadie podría recuperar los fondos</span>
        </div>
        {resilience.recoverableNow ? (
          <CutList
            cuts={resilience.cheapest}
            total={resilience.cuts.length}
            text={(e) => lossText(e, label)}
            empty={`Ninguna combinación de hasta ${resilience.searchedUpTo} desgracias lo consigue.`}
          />
        ) : (
          <p className={styles.critical}>Ya ahora mismo nadie puede recuperar los fondos.</p>
        )}
      </Section>
      {resilience.lockouts.length > 0 && (
        <Section title="Bloqueos temporales">
          <div className={styles.header}>
            <Hourglass size={14} aria-hidden />
            <span>Los fondos quedarían inmovilizados mientras dure la incapacidad; se recuperan tras el fallecimiento.</span>
          </div>
          <CutList
            cuts={resilience.lockouts.filter((c) => c.length === resilience.lockoutMinSize)}
            total={resilience.lockouts.length}
            text={(e) => lossText(e, label)}
            empty=""
            tone="warn"
          />
        </Section>
      )}
    </>
  );
}
