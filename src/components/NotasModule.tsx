import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { NoteRecord } from '../types/tax';
import { deleteNote, fetchNotes, saveNote } from '../services/appsScriptClient';

interface NotasModuleProps {
  onToast: (type: 'success' | 'warning' | 'danger' | 'info', message: string) => void;
}

export function NotasModule({ onToast }: NotasModuleProps) {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadNotes = useCallback(
    async (force = false) => {
      setLoading(true);
      try {
        const list = await fetchNotes(force);
        setNotes(list);
      } catch (err) {
        onToast(
          'danger',
          err instanceof Error ? err.message : 'Error al cargar notas.',
        );
      } finally {
        setLoading(false);
      }
    },
    [onToast],
  );

  useEffect(() => {
    loadNotes(false);
  }, [loadNotes]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      onToast('warning', 'Completá título y contenido de la nota.');
      return;
    }

    setSubmitting(true);
    try {
      await saveNote(title, content);
      onToast('success', 'Nota guardada correctamente.');
      setTitle('');
      setContent('');
      await loadNotes(true);
    } catch (err) {
      onToast(
        'danger',
        err instanceof Error ? err.message : 'Error al guardar la nota.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (note: NoteRecord) => {
    setDeletingId(note.id);
    try {
      await deleteNote(note);
      onToast('success', `Nota "${note.title}" eliminada.`);
      setConfirmDeleteId(null);
      await loadNotes(true);
    } catch (err) {
      onToast(
        'danger',
        err instanceof Error ? err.message : 'Error al eliminar la nota.',
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section aria-label="Módulo Notas" className="space-y-12">
      <div>
        <p className="text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558]">
          Notas personales
        </p>
        <h2 className="mt-1 text-[22px] font-semibold leading-7 tracking-[-0.01em] text-[#1c1b1b]">
          Recordatorios y apuntes ({notes.length})
        </h2>
      </div>

      {/* Formulario nueva nota */}
      <form
        onSubmit={handleCreate}
        className="rounded-3xl border border-[#c5c4db] bg-white p-6 sm:p-8 space-y-5"
      >
        <h3 className="text-lg font-semibold text-[#1c1b1b]">Nueva nota</h3>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="note-title-input"
              className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5"
            >
              Título *
            </label>
            <input
              id="note-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Vencimiento patente"
              className="w-full min-h-[44px] rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-2.5 text-sm text-[#1c1b1b] focus:border-[#0000ff] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="note-content-input"
              className="block text-[13px] font-medium uppercase tracking-[0.02em] text-[#454558] mb-1.5"
            >
              Contenido *
            </label>
            <textarea
              id="note-content-input"
              required
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribí el detalle o recordatorio..."
              className="w-full rounded-2xl border border-[#c5c4db] bg-[#f6f3f2] px-4 py-3 text-sm text-[#1c1b1b] focus:border-[#0000ff] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] rounded-full bg-[#0000ff] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0000cc] disabled:bg-[#dcd9d9] disabled:text-[#757589]"
          >
            {submitting ? 'Guardando...' : 'Guardar nota'}
          </button>
        </div>
      </form>

      {/* Open Rows lista notas */}
      {loading && notes.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 w-full rounded-2xl skeleton-shimmer" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-3xl border border-[#c5c4db] bg-white px-6 py-10 text-center text-sm text-[#454558]">
          No hay notas guardadas todavía.
        </div>
      ) : (
        <ul className="divide-y divide-[#c5c4db]/45">
          {notes.map((note) => {
            const awaitingConfirm = confirmDeleteId === note.id;
            const isDeleting = deletingId === note.id;
            return (
              <li
                key={note.id}
                className="flex flex-wrap items-start justify-between gap-4 py-5"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h4 className="text-base font-semibold text-[#1c1b1b]">
                      {note.title}
                    </h4>
                    <span className="text-xs font-medium uppercase tracking-[0.02em] text-[#757589] tabular-nums">
                      {note.dateStr}
                    </span>
                  </div>
                  <p className="text-sm text-[#454558] whitespace-pre-wrap">
                    {note.content || 'Sin contenido'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {awaitingConfirm ? (
                    <>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => handleDelete(note)}
                        className="min-h-[40px] rounded-full bg-[#cc0000] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        {isDeleting ? 'Eliminando...' : 'Confirmar'}
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[40px] rounded-full border border-[#c5c4db] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1c1b1b]"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(note.id)}
                      aria-label={`Eliminar nota ${note.title}`}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#c5c4db] bg-white px-4 py-2 text-xs font-semibold text-[#cc0000] transition-colors hover:bg-[#cc0000]/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Eliminar</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
