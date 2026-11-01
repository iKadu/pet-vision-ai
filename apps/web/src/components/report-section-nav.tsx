import { BarChart3, Beaker, ListTree } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';

const sections = [
  { id: 'overview', href: '/dashboard/reports', label: 'Visão geral', icon: BarChart3 },
  { id: 'events', href: '/dashboard/reports/events', label: 'Eventos', icon: ListTree },
  { id: 'experiments', href: '/dashboard/reports/experiments', label: 'Experimentos', icon: Beaker },
] as const;

export function ReportSectionNav({ active }: { active: (typeof sections)[number]['id'] }) {
  return (
    <nav aria-label="Seções dos relatórios" className="mt-5 flex w-full gap-1 overflow-x-auto border-b border-border/80 pb-px">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = section.id === active;
        return (
          <Link
            key={section.id}
            href={section.href as Route}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition ${isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
