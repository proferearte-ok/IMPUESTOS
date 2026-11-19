import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Plus, Trash2, X } from 'lucide-react';
import { SalaryFormPayload, SalaryRecord, SalaryStats } from '../types/tax';
import {
  computeAccurateSalaryStats,
  deleteSalary,
  fetchBackendSalaryStats,
  fetchSalaries,
  formatCurrencyAR,
  getTodayISO,
  saveSalary,
} from '../services/appsScriptClient';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
);

type SalaryRange = '2A' | '5A' | 'TODO';

interface SueldosModuleProps {
  onToast: (type: 'success' | 'warning' | 'danger' | 'info', message: string) => void;
}

const INITIAL_FORM = (): SalaryFormPayload => ({
  periodo: '',
  fecha: getTodayISO(),
  basico: 0,
  horasSemanales: '35',
  aumento: '',
  antiguedadPorc: '0',
  horasExtrasCant: '0',
  valorHoraExtra: 0,
  aportes: 0,
  adelantos: 0,
  aguinaldo: 0,
  bonoNoRem: 0,
  bonoRem: 0,
  otros: 0,
  otrosDesc: '',
  notas: '',
});

export function SueldosModule({ onToast }: SueldosModuleProps) {
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [backendStats, setBackendStats] = useState<SalaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<SalaryRange>('2A');
  const [showAllRows, setShowAllRows] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SalaryFormPayload>(INITIAL_FORM);
  const [formConfirmed, setFormConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState<SalaryRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const loadSalaries = useCallback(
    async (force = false) => {
      setLoading(true);
      try {
        const [rows, bStats] = await Promise.all([
          fetchSalaries(force),
          fetchBackendSalaryStats(),
        ]);
        setSalaries(rows);
        setBackendStats(bStats);
      } catch (err) {
        onToast(
          'danger',
          err instanceof Error ? err.message : 'Error al cargar sueldos.',
        );
      } finally {
        setLoading(false);
      }
    },
    [onToast],
  );

  useEffect(() => {
    loadSalaries(false);
  }, [loadSalaries]);

  const stats = useMemo(
    () => computeAccurateSalaryStats(salaries, backendStats),
    [salaries, backendStats],
  );

  const chartSeries = useMemo(() => {
    const ordered = [...salaries].sort((a, b) => a.timestamp - b.timestamp);
    const monthsLimit = range === '2A' ? 24 : range === '5A' ? 60 : ordered.length;
    const sliced = ordered.slice(-monthsLimit);
    return {
      labels: sliced.map((s) => s.periodo),
      basico: sliced.map((s) => s.basico),
      neto: sliced.map((s) => s.neto),
    };
  }, [salaries, range]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartSeries.labels.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: chartSeries.labels,
        datasets: [
          {
            label: 'Sueldo Neto',
            data: chartSeries.neto,
            borderColor: '#800080',
            backgroundColor: '#800080',
            borderWidth: 2.5,
            pointRadius: 2.5,
            tension: 0.25,
          },
          {
            label: 'Sueldo Básico',
            data: chartSeries.basico,
            borderColor: '#757589',
            backgroundColor: '#757589',
            borderWidth: 1.75,
            borderDash: [4, 4],
            pointRadius: 2,
            tension: 0.25,
          },
        ],
      },
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
              color: '#454558',
              font: { family: 'Inter, sans-serif', size: 12 },
            },
          },
          tooltip: {
            backgroundColor: '#1c1b1b',
            padding: 12,
            cornerRadius: 12,
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${formatCurrencyAR(Number(ctx.parsed.y ?? 0), true)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#757589',
              maxTicksLimit: 10,
              font: { family: 'Inter, sans-serif', size: 11 },
            },
          },
          y: {
            grid: { color: 'rgba(197, 196, 219, 0.35)' },
            border: { display: false },
            ticks: {
              color: '#757589',
              font: { family: 'Inter, sans-serif', size: 11 },
              callback: (v) => formatCurrencyAR(Number(v)),
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
  }, [chartSeries]);

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.periodo.trim() || !form.fecha || form.basico <= 0) {
      onToast('warning', 'Período, fecha y sueldo básico son obligatorios.');
      return;
    }
    if (!formConfirmed) return;

    setSubmitting(true);
    try {
      await saveSalary(form);
      onToast('success', `Sueldo "${form.periodo}" guardado correctamente.`);
      setForm(INITIAL_FORM());
      setFormConfirmed(false);
      setShowForm(false);
      await loadSalaries(true);
    } catch (err) {
      onToast(
        'danger',
        err instanceof Error ? err.message : 'Error al guardar sueldo.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSalary = async () => {
    if (!selectedSalary || !deleteConfirm || deleting) return;
    setDeleting(true);
    try {
      await deleteSalary(selectedSalary);
      onToast('success', `Registro "${selectedSalary.periodo}" eliminado.`);
      setSelectedSalary(null);
      setDeleteConfirm(false);
      await loadSalaries(true);
    } catch (err) {
      onToast(
        'danger',
        err instanceof Error ? err.message : 'Error al eliminar registro.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const visibleSalaries = showAllRows ? salaries : salaries.slice(0, 10);

  return (
    <section aria-label="Módulo Sueldos" className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.02em] text-[#800080]">
            Sueldos
          </p>
          <h2 className="mt-1 text-[22px] font-semibold leading-7 tracking-[-0.01em] text-[#1c1b1b]">
            Histórico salarial ({salaries.length} registros)
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#800080] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{showForm ? 'Cerrar formulario' : 'Nuevo registro'}</span>
        </button>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-[#c5c4db] bg-white p-6">
          <p className="text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558]">
            Promedio neto
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#1c1b1b] tabular-nums">
            {loading && salaries.length === 0
              ? '—'
              : formatCurrencyAR(stats.promedioNeto, true)}
          </p>
        </div>

        <div className="rounded-3xl border border-[#c5c4db] bg-white p-6">
          <p className="text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558]">
            Total año actual
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#1c1b1b] tabular-nums">
            {loading && salaries.length === 0
              ? '—'
              : formatCurrencyAR(stats.totalAnual, true)}
          </p>
        </div>

        <div className="rounded-3xl border border-[#c5c4db] bg-white p-6">
          <p className="text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558]">
            Mejor sueldo
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#800080] tabular-nums">
            {loading && salaries.length === 0
              ? '—'
              : formatCurrencyAR(stats.maxNeto, true)}
          </p>
          <p className="mt-1 text-xs text-[#454558] capitalize">{stats.maxPeriodo}</p>
        </div>

        <div className="rounded-3xl border border-[#c5c4db] bg-white p-6">
          <p className="text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558]">
            Antigüedad actual
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#1c1b1b] tabular-nums">
            {loading && salaries.length === 0 ? '—' : `${stats.antiguedadActual}%`}
          </p>
        </div>
      </div>

      {/* Formulario Nuevo Registro Mensual (2 columnas) */}
      {showForm && (
        <form
          onSubmit={handleSaveSalary}
          className="rounded-3xl border border-[#c5c4db] bg-white p-6 sm:p-8 space-y-6"
        >
          <h3 className="text-[22px] font-semibold leading-7 tracking-[-0.01em] text-[#1c1b1b]">
            Nuevo registro mensual
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                Período *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: noviembre 2026"
                value={form.periodo}
                onChange={(e) => setForm({ ...form, periodo: e.target.value })}
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                Fecha *
              </label>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] tabular-nums focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                Básico *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={form.basico || ''}
                onChange={(e) =>
                  setForm({ ...form, basico: Number.parseFloat(e.target.value) || 0 })
                }
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] tabular-nums focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                Horas semanales
              </label>
              <input
                type="number"
                value={form.horasSemanales}
                onChange={(e) => setForm({ ...form, horasSemanales: e.target.value })}
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] tabular-nums focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                % Antigüedad
              </label>
              <input
                type="number"
                step="0.01"
                value={form.antiguedadPorc}
                onChange={(e) => setForm({ ...form, antiguedadPorc: e.target.value })}
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] tabular-nums focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                HE Cantidad
              </label>
              <input
                type="number"
                step="0.5"
                value={form.horasExtrasCant}
                onChange={(e) => setForm({ ...form, horasExtrasCant: e.target.value })}
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] tabular-nums focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                Valor Hora Extra
              </label>
              <input
                type="number"
                step="0.01"
                value={form.valorHoraExtra || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    valorHoraExtra: Number.parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] tabular-nums focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                Aportes
              </label>
              <input
                type="number"
                step="0.01"
                value={form.aportes || ''}
                onChange={(e) =>
                  setForm({ ...form, aportes: Number.parseFloat(e.target.value) || 0 })
                }
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] tabular-nums focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                Adelantos
              </label>
              <input
                type="number"
                step="0.01"
                value={form.adelantos || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    adelantos: Number.parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] tabular-nums focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                Aguinaldo
              </label>
              <input
                type="number"
                step="0.01"
                value={form.aguinaldo || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    aguinaldo: Number.parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] tabular-nums focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                Bono No Remunerativo
              </label>
              <input
                type="number"
                step="0.01"
                value={form.bonoNoRem || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bonoNoRem: Number.parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] tabular-nums focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                Bono Remunerativo
              </label>
              <input
                type="number"
                step="0.01"
                value={form.bonoRem || ''}
                onChange={(e) =>
                  setForm({ ...form, bonoRem: Number.parseFloat(e.target.value) || 0 })
                }
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] tabular-nums focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                Otros
              </label>
              <input
                type="number"
                step="0.01"
                value={form.otros || ''}
                onChange={(e) =>
                  setForm({ ...form, otros: Number.parseFloat(e.target.value) || 0 })
                }
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] tabular-nums focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                Descripción Otros
              </label>
              <input
                type="text"
                value={form.otrosDesc}
                onChange={(e) => setForm({ ...form, otrosDesc: e.target.value })}
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5">
                Notas
              </label>
              <input
                type="text"
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] focus:border-[#0000ff] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-3">
            <input
              type="checkbox"
              checked={formConfirmed}
              onChange={(e) => setFormConfirmed(e.target.checked)}
              className="h-5 w-5 accent-[#0000ff]"
            />
            <span className="text-sm font-medium text-[#1c1b1b]">
              Confirmo los datos del recibo mensual
            </span>
          </label>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="min-h-[44px] rounded-full border border-[#c5c4db] bg-white px-5 py-2.5 text-sm font-semibold text-[#1c1b1b] hover:bg-[#f6f3f2]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!formConfirmed || submitting}
              className="min-h-[44px] rounded-full bg-[#0000ff] px-7 py-2.5 text-sm font-semibold text-white hover:bg-[#0000cc] disabled:bg-[#dcd9d9] disabled:text-[#757589]"
            >
              {submitting ? 'Guardando...' : 'Guardar sueldo'}
            </button>
          </div>
        </form>
      )}

      {/* Gráfico Evolución Sueldos */}
      <div className="rounded-3xl border border-[#c5c4db] bg-white p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-[22px] font-semibold leading-7 tracking-[-0.01em] text-[#1c1b1b]">
              Básico vs Neto
            </h3>
            <p className="mt-1 text-sm text-[#454558]">
              Evolución histórica de haberes
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(
              [
                { key: '2A', label: '2 Años' },
                { key: '5A', label: '5 Años' },
                { key: 'TODO', label: 'Todo' },
              ] as { key: SalaryRange; label: string }[]
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRange(opt.key)}
                className={`min-h-[40px] rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  range === opt.key
                    ? 'bg-[#1c1b1b] text-white'
                    : 'bg-[#ebe7e7] text-[#454558] hover:bg-[#e5e2e1]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative h-72 w-full">
          <canvas ref={canvasRef} aria-label="Gráfico evolución de sueldos" />
        </div>
      </div>

      {/* Tabla de registros */}
      <div className="rounded-3xl border border-[#c5c4db] bg-white p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[22px] font-semibold leading-7 tracking-[-0.01em] text-[#1c1b1b]">
            Últimos recibos
          </h3>
          <span className="text-xs font-medium uppercase tracking-[0.02em] text-[#454558]">
            Tocá una fila para ver detalle
          </span>
        </div>

        {loading && salaries.length === 0 ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 w-full rounded-xl skeleton-shimmer" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#c5c4db]/60 text-[12px] font-medium uppercase tracking-[0.02em] text-[#454558]">
                  <th className="py-3 pr-4">Período</th>
                  <th className="py-3 px-3 text-right">Básico</th>
                  <th className="py-3 px-3 text-right">Neto</th>
                  <th className="py-3 px-3 text-right">Aguinaldo</th>
                  <th className="py-3 pl-3 text-right">HE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c5c4db]/45 text-sm">
                {visibleSalaries.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      setSelectedSalary(row);
                      setDeleteConfirm(false);
                    }}
                    className="cursor-pointer transition-colors hover:bg-[#f6f3f2]"
                  >
                    <td className="py-3.5 pr-4 font-medium text-[#1c1b1b] capitalize">
                      {row.periodo}
                    </td>
                    <td className="py-3.5 px-3 text-right text-[#454558] tabular-nums">
                      {formatCurrencyAR(row.basico, true)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-semibold text-[#1c1b1b] tabular-nums">
                      {formatCurrencyAR(row.neto, true)}
                    </td>
                    <td className="py-3.5 px-3 text-right text-[#454558] tabular-nums">
                      {row.aguinaldo > 0 ? formatCurrencyAR(row.aguinaldo, true) : '—'}
                    </td>
                    <td className="py-3.5 pl-3 text-right text-[#454558] tabular-nums">
                      {row.totalHe > 0 ? formatCurrencyAR(row.totalHe, true) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {salaries.length > 10 && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setShowAllRows((prev) => !prev)}
              className="min-h-[44px] rounded-full border border-[#c5c4db] bg-white px-5 py-2 text-sm font-semibold text-[#1c1b1b] hover:bg-[#f6f3f2]"
            >
              {showAllRows
                ? 'Mostrar últimos 10'
                : `Ver los ${salaries.length} registros`}
            </button>
          </div>
        )}
      </div>

      {/* Modal Detalle Completo (20 columnas) */}
      {selectedSalary && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/35 backdrop-blur-xs sm:p-6"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setSelectedSalary(null);
          }}
        >
          <div className="w-full sm:max-w-[560px] max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[#c5c4db] bg-white px-6 pt-3 pb-8 sm:p-8">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#e5e2e1] sm:hidden" />
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#c5c4db]/50">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.02em] text-[#800080]">
                  Recibo mensual
                </p>
                <h3 className="text-[22px] font-semibold text-[#1c1b1b] capitalize">
                  {selectedSalary.periodo}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSalary(null)}
                aria-label="Cerrar detalle de sueldo"
                className="flex h-11 w-11 items-center justify-center rounded-full text-[#454558] hover:bg-[#f1edec]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              {[
                ['Fecha', selectedSalary.fechaStr],
                ['Básico', formatCurrencyAR(selectedSalary.basico, true)],
                ['Horas semanales', String(selectedSalary.horas)],
                ['% Aumento', selectedSalary.aumentoPorc || '—'],
                ['% Antigüedad', `${selectedSalary.antiguedadPorc}%`],
                ['Antigüedad $', formatCurrencyAR(selectedSalary.antiguedadPesos, true)],
                ['HE Cantidad', String(selectedSalary.heCant)],
                ['Valor HE', formatCurrencyAR(selectedSalary.vhe, true)],
                ['Total HE', formatCurrencyAR(selectedSalary.totalHe, true)],
                ['Aportes', formatCurrencyAR(selectedSalary.aportes, true)],
                ['Adelantos', formatCurrencyAR(selectedSalary.adelantos, true)],
                ['Aguinaldo', formatCurrencyAR(selectedSalary.aguinaldo, true)],
                ['Bono No Rem.', formatCurrencyAR(selectedSalary.bonoNoRem, true)],
                ['Bono Rem.', formatCurrencyAR(selectedSalary.bonoRem, true)],
                ['Otros', formatCurrencyAR(selectedSalary.otros, true)],
                ['Desc. Otros', selectedSalary.descOtros || '—'],
                ['Bruto', formatCurrencyAR(selectedSalary.bruto, true)],
                ['Neto', formatCurrencyAR(selectedSalary.neto, true)],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between border-b border-[#c5c4db]/30 py-1.5">
                  <span className="text-[#454558]">{label}</span>
                  <span className="font-medium text-[#1c1b1b] tabular-nums">{val}</span>
                </div>
              ))}
            </div>

            {selectedSalary.notas && (
              <div className="mt-4 rounded-2xl bg-[#f6f3f2] p-3 text-sm">
                <span className="block text-xs uppercase text-[#454558] mb-1">Notas</span>
                <p className="text-[#1c1b1b]">{selectedSalary.notas}</p>
              </div>
            )}

            <div className="mt-6 border-t border-[#c5c4db]/50 pt-4 space-y-3">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.checked)}
                  className="h-4 w-4 accent-[#cc0000]"
                />
                <span className="text-xs font-medium text-[#454558]">
                  Confirmo que deseo eliminar este recibo
                </span>
              </label>
              <div className="flex justify-between gap-3">
                <button
                  type="button"
                  disabled={!deleteConfirm || deleting}
                  onClick={handleDeleteSalary}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#cc0000]/30 px-4 py-2 text-xs font-semibold text-[#cc0000] hover:bg-[#cc0000]/10 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>{deleting ? 'Eliminando...' : 'Eliminar'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSalary(null)}
                  className="min-h-[44px] rounded-full border border-[#c5c4db] bg-white px-6 py-2 text-sm font-semibold text-[#1c1b1b] hover:bg-[#f6f3f2]"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
