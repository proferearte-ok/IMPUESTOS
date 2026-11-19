import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { TaxRecord } from '../types/tax';
import { formatCurrencyAR } from '../services/appsScriptClient';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
);

type RangeKey = '3M' | '6M' | '1A' | 'TODO';
type SelectorMode = 'TOP5' | 'TODOS' | 'PERSONALIZAR';

interface TaxEvolutionChartProps {
  taxes: TaxRecord[];
}

const LINE_COLORS = [
  '#0000ff',
  '#800080',
  '#1c1b1b',
  '#008000',
  '#cc7700',
  '#cc0000',
  '#454558',
  '#3b82f6',
  '#0d9488',
  '#6366f1',
];

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const idx = Number.parseInt(m, 10) - 1;
  return `${months[idx] ?? m} ${y.slice(2)}`;
}

export function TaxEvolutionChart({ taxes }: TaxEvolutionChartProps) {
  const [range, setRange] = useState<RangeKey>('6M');
  const [mode, setMode] = useState<SelectorMode>('TOP5');
  const [customSelected, setCustomSelected] = useState<string[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const paidTaxes = useMemo(
    () => taxes.filter((t) => t.status === 'PAGADO' && t.isoDate),
    [taxes],
  );

  const rankedTaxNames = useMemo(() => {
    const totals = new Map<string, number>();
    paidTaxes.forEach((t) => {
      totals.set(t.name, (totals.get(t.name) ?? 0) + t.amount);
    });
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [paidTaxes]);

  useEffect(() => {
    if (customSelected.length === 0 && rankedTaxNames.length > 0) {
      setCustomSelected(rankedTaxNames.slice(0, 3));
    }
  }, [rankedTaxNames, customSelected.length]);

  const activeTaxNames = useMemo(() => {
    if (mode === 'TOP5') return rankedTaxNames.slice(0, 5);
    if (mode === 'TODOS') return rankedTaxNames;
    return customSelected;
  }, [mode, rankedTaxNames, customSelected]);

  const chartData = useMemo(() => {
    const now = new Date();
    const cutoffMonths = range === '3M' ? 3 : range === '6M' ? 6 : range === '1A' ? 12 : null;
    let cutoffYm: string | null = null;
    if (cutoffMonths !== null) {
      const d = new Date(now.getFullYear(), now.getMonth() - (cutoffMonths - 1), 1);
      cutoffYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    const monthSet = new Set<string>();
    const map = new Map<string, Map<string, number>>();

    paidTaxes.forEach((t) => {
      if (!activeTaxNames.includes(t.name)) return;
      const ym = t.isoDate.slice(0, 7);
      if (cutoffYm && ym < cutoffYm) return;
      monthSet.add(ym);
      if (!map.has(t.name)) map.set(t.name, new Map());
      const byMonth = map.get(t.name)!;
      byMonth.set(ym, (byMonth.get(ym) ?? 0) + t.amount);
    });

    const sortedMonths = Array.from(monthSet).sort();
    const labels = sortedMonths.map(formatMonthLabel);

    const datasets = activeTaxNames
      .filter((name) => map.has(name))
      .map((name, idx) => {
        const byMonth = map.get(name)!;
        const color = LINE_COLORS[idx % LINE_COLORS.length];
        return {
          label: name,
          data: sortedMonths.map((ym) => byMonth.get(ym) ?? null),
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.25,
          spanGaps: true,
        };
      });

    return { labels, datasets };
  }, [paidTaxes, activeTaxNames, range]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: 'circle',
              color: '#454558',
              font: { family: 'Inter, sans-serif', size: 12 },
            },
          },
          tooltip: {
            backgroundColor: '#1c1b1b',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            padding: 12,
            cornerRadius: 12,
            callbacks: {
              label: (ctx) => {
                const val = typeof ctx.parsed.y === 'number' ? ctx.parsed.y : 0;
                return `${ctx.dataset.label}: ${formatCurrencyAR(val)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#757589', font: { family: 'Inter, sans-serif', size: 11 } },
          },
          y: {
            grid: { color: 'rgba(197, 196, 219, 0.35)' },
            border: { display: false },
            ticks: {
              color: '#757589',
              font: { family: 'Inter, sans-serif', size: 11 },
              callback: (value) => formatCurrencyAR(Number(value)),
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [chartData]);

  const toggleCustomTax = (name: string) => {
    setCustomSelected((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name],
    );
  };

  return (
    <section
      aria-label="Evolución de impuestos pagados"
      className="rounded-3xl border border-[#c5c4db] bg-white p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-[22px] font-semibold leading-7 tracking-[-0.01em] text-[#1c1b1b]">
            Evolución mensual
          </h3>
          <p className="mt-1 text-sm text-[#454558]">
            Importes pagados por concepto y período
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: '3M', label: '3 Meses' },
              { key: '6M', label: '6 Meses' },
              { key: '1A', label: '1 Año' },
              { key: 'TODO', label: 'Todo' },
            ] as { key: RangeKey; label: string }[]
          ).map((item) => {
            const active = range === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setRange(item.key)}
                className={`min-h-[40px] rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#1c1b1b] text-white'
                    : 'bg-[#ebe7e7] text-[#454558] hover:bg-[#e5e2e1]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'TOP5', label: 'Top 5' },
            { key: 'TODOS', label: 'Todos' },
            { key: 'PERSONALIZAR', label: 'Personalizar' },
          ] as { key: SelectorMode; label: string }[]
        ).map((opt) => {
          const active = mode === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              className={`min-h-[40px] rounded-full px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#e8e8ff] text-[#0000ff]'
                  : 'border border-[#c5c4db] bg-white text-[#454558] hover:bg-[#f6f3f2]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {mode === 'PERSONALIZAR' && (
        <div className="flex flex-wrap gap-2 pt-1">
          {rankedTaxNames.map((name) => {
            const selected = customSelected.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleCustomTax(name)}
                className={`min-h-[36px] rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  selected
                    ? 'bg-[#0000ff] text-white'
                    : 'bg-[#ebe7e7] text-[#454558] hover:bg-[#e5e2e1]'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      {chartData.datasets.length === 0 ? (
        <div className="flex h-56 items-center justify-center rounded-2xl bg-[#f6f3f2] text-sm text-[#454558]">
          No hay pagos registrados en este período o selección.
        </div>
      ) : (
        <div className="relative h-72 w-full">
          <canvas ref={canvasRef} aria-label="Gráfico de evolución de impuestos" />
        </div>
      )}
    </section>
  );
}
