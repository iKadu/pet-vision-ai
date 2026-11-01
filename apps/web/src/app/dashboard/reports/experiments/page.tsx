'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { BarChart3, Beaker, CheckCircle2, ClipboardList, Link2, Save } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/utils/trpc';
import { IdentificationEvaluationPanel } from '@/components/identification-evaluation-panel';
import { ReportSectionNav } from '@/components/report-section-nav';

const statusLabels = {
  draft: 'Rascunho',
  ready: 'Pronto para análise',
  completed: 'Concluído',
  archived: 'Arquivado',
} as const;

type ExperimentStatus = keyof typeof statusLabels;

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function ExperimentSessionsPage() {
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [monitoringSessionId, setMonitoringSessionId] = useState('');
  const experimentsQuery = useQuery(trpc.experiments.list.queryOptions());
  const optionsQuery = useQuery(trpc.reports.filterOptions.queryOptions());
  const identificationEvaluationQuery = useQuery({
    ...trpc.reports.identificationEvaluation.queryOptions(),
    enabled: false,
    retry: false,
  });
  const createExperiment = useMutation(trpc.experiments.create.mutationOptions());
  const updateExperiment = useMutation(trpc.experiments.update.mutationOptions());

  const finishedMonitoringSessions = (optionsQuery.data?.monitoringSessions ?? []).filter((session) => session.status !== 'active');

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || createExperiment.isPending) return;

    try {
      await createExperiment.mutateAsync({
        name: name.trim(),
        objective: objective.trim() || null,
        monitoringSessionId: monitoringSessionId || null,
      });
      setName('');
      setObjective('');
      setMonitoringSessionId('');
      await Promise.all([experimentsQuery.refetch(), optionsQuery.refetch()]);
      toast.success('Sessão experimental registrada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar a sessão experimental.');
    }
  }

  async function changeStatus(id: string, status: ExperimentStatus) {
    try {
      await updateExperiment.mutateAsync({ id, data: { status } });
      await experimentsQuery.refetch();
      toast.success('Status da sessão atualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a sessão.');
    }
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-border/80 pb-7 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">Experimentos</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Organize as execuções usadas na validação experimental sem alterar o monitoramento diário.</p></div><Link href={'/dashboard/reports/compare' as Route} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:border-primary/35 hover:text-primary"><BarChart3 className="h-3.5 w-3.5" />Comparar experimentos</Link></header>
        <ReportSectionNav active="experiments" />

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6"><div className="flex items-start gap-3 border-b border-border/80 pb-5"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Beaker className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Novo recorte</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Registrar experimento</h2></div></div>
            <form onSubmit={handleCreate} className="mt-6"><label className="block text-xs font-semibold text-foreground">Nome do experimento<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Detecção em ambiente interno" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label><label className="mt-4 block text-xs font-semibold text-foreground">Objetivo (opcional)<textarea value={objective} onChange={(event) => setObjective(event.target.value)} maxLength={500} rows={3} placeholder="Descreva o cenário e o que será observado." className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label><label className="mt-4 block text-xs font-semibold text-foreground">Sessão de monitoramento encerrada (opcional)<select value={monitoringSessionId} onChange={(event) => setMonitoringSessionId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="">Vincular depois</option>{finishedMonitoringSessions.map((session) => <option key={session.id} value={session.id}>{session.cameraName ?? 'Câmera removida'} · {formatDate(session.startedAt)}</option>)}</select></label><div className="mt-6 flex items-center gap-3 border-t border-border/80 pt-5"><button type="submit" disabled={!name.trim() || createExperiment.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />{createExperiment.isPending ? 'Registrando...' : 'Registrar sessão'}</button><p className="text-xs leading-5 text-muted-foreground">Somente sessões encerradas podem ser vinculadas.</p></div></form>
          </section>

          <aside className="self-start rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6"><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Uso recomendado</p></div><ol className="mt-5 space-y-4">{['Conclua a execução do monitoramento.', 'Registre o objetivo e vincule a sessão gerada.', 'Filtre esse recorte na página de relatórios e exporte a evidência.'].map((item, index) => <li key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">0{index + 1}</span>{item}</li>)}</ol><p className="mt-6 border-t border-border/80 pt-5 text-xs leading-5 text-muted-foreground">O registro organiza a coleta; ele não substitui o protocolo, as anotações manuais nem a análise dos resultados da monografia.</p></aside>
        </div>

        <section className="mt-6 rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6"><div className="flex items-center gap-3 border-b border-border/80 pb-5"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Link2 className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Registro acadêmico</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Experimentos salvos</h2></div></div>
          {experimentsQuery.isPending ? <div className="mt-5 space-y-3">{[0, 1].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-surface-raised" />)}</div> : experimentsQuery.data?.length ? <div className="mt-2 divide-y divide-border/70">{experimentsQuery.data.map((experiment) => <article key={experiment.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-card-foreground">{experiment.name}</h3>{experiment.monitoringSessionId && <span className="rounded-full bg-info/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-info">Sessão vinculada</span>}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{experiment.objective || 'Objetivo ainda não informado.'}</p><p className="mt-1 text-[11px] text-muted-foreground">{experiment.cameraName ?? (experiment.monitoringSessionId ? 'Câmera removida' : 'Sem sessão vinculada')} · criado em {formatDate(experiment.createdAt)}</p></div><label className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Status<select value={experiment.status} onChange={(event) => void changeStatus(experiment.id, event.target.value as ExperimentStatus)} disabled={updateExperiment.isPending} className="mt-1.5 block h-9 rounded-lg border border-border bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground outline-none focus:border-primary"><option value="draft">{statusLabels.draft}</option><option value="ready">{statusLabels.ready}</option><option value="completed">{statusLabels.completed}</option><option value="archived">{statusLabels.archived}</option></select></label></article>)}</div> : <div className="py-12 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-primary" /><p className="mt-3 text-sm font-semibold text-card-foreground">Nenhum experimento registrado</p><p className="mt-1 text-sm text-muted-foreground">Crie o primeiro recorte quando tiver uma sessão de monitoramento encerrada.</p></div>}
        </section>

        <details className="group mt-6 rounded-[28px] border border-border/80 bg-card/80 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 sm:px-6 [&::-webkit-details-marker]:hidden"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Análise avançada</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Avaliação de identificação</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">ROC, Precisão–Revocação e evidências das referências cadastradas.</p></div><span className="rounded-full border border-border bg-background px-3 py-1.5 text-[10px] font-semibold text-muted-foreground transition group-open:border-primary/35 group-open:text-primary">Abrir</span></summary>
          <div className="border-t border-border/80 px-5 pb-5 sm:px-6 sm:pb-6"><IdentificationEvaluationPanel evaluation={identificationEvaluationQuery.data} isGenerating={identificationEvaluationQuery.isFetching} error={identificationEvaluationQuery.error?.message ?? null} onGenerate={() => void identificationEvaluationQuery.refetch()} /></div>
        </details>
      </div>
    </div>
  );
}
