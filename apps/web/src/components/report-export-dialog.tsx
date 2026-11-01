'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, Download, FileText, ListTree, X } from 'lucide-react';

export type ReportExportKind = 'summary-csv' | 'summary-json' | 'events-csv' | 'timeline-svg' | 'timeline-png' | 'roc-svg' | 'roc-png' | 'precision-recall-svg' | 'precision-recall-png' | 'evaluation-json';

type ExportContent = 'summary' | 'events' | 'timeline' | 'evaluation';

const contentOptions: Array<{
  id: ExportContent;
  label: string;
  description: string;
  icon: typeof FileText;
  formats: Array<{ id: ReportExportKind; label: string }>;
}> = [
  {
    id: 'summary',
    label: 'Resumo do monitoramento',
    description: 'Indicadores, sessões e recorte atual.',
    icon: FileText,
    formats: [
      { id: 'summary-csv', label: 'CSV' },
      { id: 'summary-json', label: 'JSON' },
    ],
  },
  {
    id: 'events',
    label: 'Histórico de eventos',
    description: 'Eventos do período com os filtros aplicados.',
    icon: ListTree,
    formats: [{ id: 'events-csv', label: 'CSV' }],
  },
  {
    id: 'timeline',
    label: 'Gráfico de atividade',
    description: 'Linha do tempo de detecções, identificações e alertas.',
    icon: BarChart3,
    formats: [
      { id: 'timeline-svg', label: 'SVG' },
      { id: 'timeline-png', label: 'PNG' },
    ],
  },
  {
    id: 'evaluation',
    label: 'Resultados experimentais',
    description: 'Curvas ROC, Precisão–Revocação e dados auditáveis.',
    icon: BarChart3,
    formats: [
      { id: 'roc-svg', label: 'ROC SVG' },
      { id: 'roc-png', label: 'ROC PNG' },
      { id: 'precision-recall-svg', label: 'P–R SVG' },
      { id: 'precision-recall-png', label: 'P–R PNG' },
      { id: 'evaluation-json', label: 'JSON' },
    ],
  },
];

export function ReportExportDialog({
  open,
  isExporting,
  canExport,
  includeEvaluation = false,
  availableContentIds,
  unavailableFormats = [],
  error,
  onClose,
  onExport,
}: {
  open: boolean;
  isExporting: boolean;
  canExport: { summary: boolean; events: boolean; timeline: boolean; evaluation: boolean };
  includeEvaluation?: boolean;
  availableContentIds?: ExportContent[];
  unavailableFormats?: ReportExportKind[];
  error: string | null;
  onClose: () => void;
  onExport: (kind: ReportExportKind) => void | Promise<void>;
}) {
  const [selectedContent, setSelectedContent] = useState<ExportContent>('summary');
  const availableContentOptions = useMemo(
    () => contentOptions.filter((option) => (includeEvaluation || option.id !== 'evaluation') && (!availableContentIds || availableContentIds.includes(option.id))),
    [availableContentIds, includeEvaluation],
  );
  const selected = useMemo(
    () => availableContentOptions.find((option) => option.id === selectedContent) ?? availableContentOptions[0],
    [availableContentOptions, selectedContent],
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isExporting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExporting, onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="Fechar exportação"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        disabled={isExporting}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-export-title"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-[26px] border border-border bg-card shadow-[0_24px_80px_oklch(0_0_0_/_0.35)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border/80 px-5 py-5 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Exportação</p>
            <h2 id="report-export-title" className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Exportar relatório</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Os arquivos respeitam os filtros aplicados neste momento.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isExporting} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <fieldset>
            <legend className="text-xs font-semibold text-card-foreground">Conteúdo</legend>
            <div className="mt-3 space-y-2">
              {availableContentOptions.map((option) => {
                const Icon = option.icon;
                const unavailable = !canExport[option.id];
                const selectedOption = selected.id === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedContent(option.id)}
                    disabled={unavailable || isExporting}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${selectedOption ? 'border-primary bg-primary/10' : 'border-border bg-background/45 hover:border-primary/35 hover:bg-surface-raised/70'}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selectedOption ? 'bg-primary text-primary-foreground' : 'bg-surface-raised text-muted-foreground'}`}><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-card-foreground">{option.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{unavailable ? 'Ainda não há dados disponíveis.' : option.description}</span></span>
                    {selectedOption && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold text-card-foreground">Formato disponível</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {selected.formats.map((format) => {
                const unavailable = unavailableFormats.includes(format.id);
                return (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => void onExport(format.id)}
                  disabled={!canExport[selected.id] || isExporting || unavailable}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {isExporting ? 'Preparando...' : unavailable ? `${format.label} indisponível` : `Baixar ${format.label}`}
                </button>
              );})}
            </div>
          </fieldset>

          {error && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/[0.07] px-3 py-2.5 text-xs leading-5 text-destructive">{error}</p>}
        </div>
      </section>
    </div>
  );
}
