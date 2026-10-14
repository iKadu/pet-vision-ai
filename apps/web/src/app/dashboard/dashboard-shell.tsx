'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { useState } from 'react';
import {
  Camera,
  ChevronRight,
  Dog,
  LayoutDashboard,
  Menu,
  Settings2,
  X,
} from 'lucide-react';

import { ModeToggle } from '@/components/mode-toggle';
import UserMenu from '@/components/user-menu';

type Props = { children: React.ReactNode };

type NavigationItem = {
  href: Route;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  active: boolean;
};

export default function DashboardShell({ children }: Props) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const sidebarWidth = expanded ? 'ml-[264px]' : 'ml-[84px]';
  const navItemClass = (active: boolean) => [
    'group relative flex h-12 items-center rounded-2xl px-3 transition-[background-color,color,box-shadow,transform] duration-200',
    active
      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_8px_18px_color-mix(in_oklch,var(--primary)_10%,transparent)]'
      : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground',
  ].join(' ');

  const links: NavigationItem[] = [
    {
      href: '/dashboard',
      label: 'Visão geral',
      description: 'Status do monitoramento',
      icon: LayoutDashboard,
      active: pathname === '/dashboard',
    },
    {
      href: '/dashboard/cameras',
      label: 'Câmeras',
      description: 'Fontes e transmissão',
      icon: Camera,
      active: pathname.startsWith('/dashboard/cameras'),
    },
    {
      href: '/dashboard/animals',
      label: 'Animais',
      description: 'Perfis e referências',
      icon: Dog,
      active: pathname.startsWith('/dashboard/animals'),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-20 flex h-screen flex-col border-r border-sidebar-border/80 bg-sidebar/95 px-3 py-4 text-sidebar-foreground backdrop-blur-xl transition-[width] duration-300 ${expanded ? 'w-[264px]' : 'w-[84px]'}`}
      >
        <div className={`flex min-h-12 items-center ${expanded ? 'justify-between px-1' : 'justify-center'}`}>
          {expanded && (
            <Link href="/dashboard" className="group flex min-w-0 items-center gap-3" aria-label="PetVision, ir para visão geral">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_18px_color-mix(in_oklch,var(--primary)_22%,transparent)] transition-transform duration-200 group-hover:scale-[1.03]">
                <Dog className="h-[19px] w-[19px]" strokeWidth={2.3} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold tracking-[-0.02em] text-sidebar-foreground">PetVision</span>
                <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.13em] text-muted-foreground">Monitoramento</span>
              </span>
            </Link>
          )}
          <button
            type="button"
            aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
            onClick={() => setExpanded((value) => !value)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {expanded ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        <nav className="mt-10" aria-label="Áreas principais">
          {expanded && <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Central</p>}
          <div className="space-y-1.5">
            {links.map(({ href, label, description, icon: Icon, active }) => (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                title={!expanded ? label : undefined}
                className={navItemClass(active)}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${active ? 'bg-primary/12 text-primary' : 'bg-surface-raised text-muted-foreground group-hover:text-foreground'}`}>
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                {expanded && (
                  <span className="ml-3 min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-4">{label}</span>
                    <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground group-hover:text-muted-foreground">{description}</span>
                  </span>
                )}
                {expanded && (active ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/65 transition-transform group-hover:translate-x-0.5" />)}
              </Link>
            ))}
          </div>
        </nav>

        <div className="mt-auto border-t border-sidebar-border/80 pt-4">
          {expanded && <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Conta</p>}
          <Link
            href={'/dashboard/settings' as Route}
            aria-current={pathname.startsWith('/dashboard/settings') ? 'page' : undefined}
            title={!expanded ? 'Configurações' : undefined}
            className={navItemClass(pathname.startsWith('/dashboard/settings'))}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${pathname.startsWith('/dashboard/settings') ? 'bg-primary/12 text-primary' : 'bg-surface-raised text-muted-foreground'}`}>
              <Settings2 className="h-4 w-4" strokeWidth={2} />
            </span>
            {expanded && <span className="ml-3 flex-1 text-sm font-medium">Configurações</span>}
            {expanded && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/65" />}
          </Link>

          <div className={`mt-3 flex items-center rounded-2xl border border-sidebar-border/70 bg-card/50 p-1.5 ${expanded ? 'justify-between gap-2' : 'justify-center'}`}>
            <ModeToggle />
            {expanded && <UserMenu />}
          </div>
          {!expanded && <div className="mt-3 flex justify-center"><UserMenu compact /></div>}
        </div>
      </aside>

      <main className={`${sidebarWidth} pv-app-canvas min-h-screen overflow-x-hidden transition-[margin-left] duration-300`}>
        {children}
      </main>
    </div>
  );
}
