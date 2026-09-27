'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import { Camera, ChevronRight, Dog, Menu, PawPrint, Settings2, X } from 'lucide-react';

import { ModeToggle } from '@/components/mode-toggle';
import UserMenu from '@/components/user-menu';

type Props = { children: React.ReactNode };

export default function DashboardShell({ children }: Props) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const sidebarWidth = expanded ? 'ml-56' : 'ml-[76px]';
  const cardClass = (active: boolean) => `group flex items-center justify-between rounded-lg border px-3 py-3 transition-[background-color,border-color,color,box-shadow] duration-200 ${active ? 'border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-sm' : 'border-transparent text-muted-foreground hover:border-sidebar-border hover:bg-surface-raised hover:text-foreground'}`;

  const links = [
    { href: '/dashboard', label: 'Início', icon: PawPrint, active: pathname === '/dashboard' },
    { href: '/dashboard/cameras', label: 'Câmeras', icon: Camera, active: pathname.startsWith('/dashboard/cameras') },
    { href: '/dashboard/animals', label: 'Animais', icon: Dog, active: pathname.startsWith('/dashboard/animals') },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <aside className={`fixed inset-y-0 left-0 z-20 flex h-screen flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 text-sidebar-foreground transition-[width] duration-200 ${expanded ? 'w-56' : 'w-[76px]'}`}>
        <div className={`flex items-center ${expanded ? 'justify-between px-2' : 'justify-center'}`}>
          {expanded && <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Dog className="h-4 w-4" /></span><span className="text-sm font-semibold text-sidebar-foreground">PetVision</span></div>}
          <button type="button" aria-label={expanded ? 'Recolher menu' : 'Expandir menu'} onClick={() => setExpanded((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground">{expanded ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
        </div>
        <nav className="mt-10 space-y-2" aria-label="Áreas principais">
          {links.map(({ href, label, icon: Icon, active }) => <Link key={href} href={href} aria-current={active ? 'page' : undefined} title={!expanded ? label : undefined} className={cardClass(active)}><span className={`flex items-center ${expanded ? 'gap-3' : 'justify-center w-full'}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-raised"><Icon className="h-4 w-4" /></span>{expanded && <span className="text-sm font-medium">{label}</span>}</span>{expanded && <ChevronRight className="h-4 w-4 text-muted-foreground" />}</Link>)}
        </nav>
        <div className="mt-auto space-y-2 border-t border-sidebar-border pt-4">
          <Link href={'/dashboard/settings' as Route} aria-current={pathname.startsWith('/dashboard/settings') ? 'page' : undefined} title={!expanded ? 'Configurações' : undefined} className={cardClass(pathname.startsWith('/dashboard/settings'))}><span className={`flex items-center ${expanded ? 'gap-3' : 'justify-center w-full'}`}><span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-raised"><Settings2 className="h-4 w-4" /></span>{expanded && <span className="text-sm font-medium">Configurações</span>}</span>{expanded && <ChevronRight className="h-4 w-4 text-muted-foreground" />}</Link>
          <div className={`flex min-h-9 items-center ${expanded ? 'justify-between gap-2' : 'justify-center'} rounded-lg px-1 py-1`}>
            <ModeToggle />
            {expanded && <UserMenu />}
          </div>
          {!expanded && <div className="flex justify-center"><UserMenu compact /></div>}
        </div>
      </aside>
      <main className={`${sidebarWidth} min-h-screen transition-[margin-left] duration-200`}>{children}</main>
    </div>
  );
}
