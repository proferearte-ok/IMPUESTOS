import { TaxRecord } from '../types/tax';
import { formatCurrencyAR, getUrgencyInfo } from '../services/appsScriptClient';

interface MaSummaryPanelProps {
  taxes: TaxRecord[];
  onPayNow: (record: TaxRecord) => void;
}

export function MaSummaryPanel({ taxes, onPayNow }: MaSummaryPanelProps) {
  const maPending = taxes.filter(
    (t) => t.status === 'PENDIENTE' && t.name.toUpperCase().startsWith('MA'),
  );
  const maTotal = maPending.reduce((acc, t) => acc + t.amount, 0);
  const maOverdueCount = maPending.filter((t) => t.derivedStatus === 'VENCIDO').length;

  return (
    <section
      aria-label="Resumen MA"
      className="rounded-3xl border border-[#c5c4db] bg-white p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[#c5c4db]/50 pb-5">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.02em] text-[#800080]">
            Resumen MA
          </p>
          <h3 className="mt-1 text-[22px] font-semibold leading-7 tracking-[-0.01em] text-[#1c1b1b]">
            Pendientes y vencidos de MA
          </h3>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-2xl font-semibold text-[#800080] tabular-nums">
            {formatCurrencyAR(maTotal)}
          </p>
          <p className="text-xs font-medium uppercase tracking-[0.02em] text-[#454558] tabular-nums">
            {maPending.length} {maPending.length === 1 ? 'pendiente' : 'pendientes'}
            {maOverdueCount > 0 && ` · ${maOverdueCount} vencidos`}
          </p>
        </div>
      </div>

      {maPending.length === 0 ? (
        <p className="py-4 text-sm text-[#454558]">
          No hay impuestos MA pendientes o vencidos en este momento.
        </p>
      ) : (
        <ul className="divide-y divide-[#c5c4db]/45">
          {maPending.map((item) => {
            const urgency = getUrgencyInfo(item.isoDate);
            const isOverdue = item.derivedStatus === 'VENCIDO';
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div className="min-w-0">
                  <p className="text-base font-medium text-[#1c1b1b]">{item.name}</p>
                  <p className="mt-0.5 text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] tabular-nums">
                    {item.dateStr} · {item.method}{' '}
                    <span className={isOverdue ? 'text-[#cc0000]' : 'text-[#800080]'}>
                      · {urgency.label}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-base font-semibold text-[#1c1b1b] tabular-nums">
                    {formatCurrencyAR(item.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onPayNow(item)}
                    className="min-h-[44px] rounded-full bg-[#800080] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
                  >
                    Pagar ahora
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
