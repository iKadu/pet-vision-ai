'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { Camera, ChevronRight, Dog, Menu, PawPrint, Settings2, UsersRound, X } from 'lucide-react';

import { ModeToggle } from '@/components/mode-toggle';
import UserMenu from '@/components/user-menu';

type Props = { children: React.ReactNode };

export default function DashboardShell({ children }: Props) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const sidebarWidth = expanded ? 'ml-56' : 'ml-[76px]';
  const cardClass = (active: boolean) => `group flex items-center justify-between rounded-lg border px-3 py-3 transition-[border-color,box-shadow,color] duration-200 ${active ? 'border-zinc-300 text-zinc-900 shadow-sm' : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-900'}`;

  const links = [
    { href: '/dashboard', label: 'Início', icon: PawPrint, active: pathname === '/dashboard' },
    { href: '/dashboard/cameras', label: 'Câmeras', icon: Camera, active: pathname.startsWith('/dashboard/cameras') },
    { href: '/dashboard/animals', label: 'Animais', icon: Dog, active: pathname.startsWith('/dashboard/animals') },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      <aside className={`fixed inset-y-0 left-0 z-20 flex h-screen flex-col border-r border-zinc-200 bg-white px-3 py-5 transition-[width] duration-200 ${expanded ? 'w-56' : 'w-[76px]'}`}>
        <div className={`flex items-center ${expanded ? 'justify-between px-2' : 'justify-center'}`}>
          {expanded && <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-white"><Dog className="h-4 w-4" /></span><span className="text-sm font-semibold text-zinc-900">PetVision</span></div>}
          <button type="button" aria-label={expanded ? 'Recolher menu' : 'Expandir menu'} onClick={() => setExpanded((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950">{expanded ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
        </div>
        <nav className="mt-10 space-y-2" aria-label="Áreas principais">
          {links.map(({ href, label, icon: Icon, active }) => <Link key={href} href={href} aria-current={active ? 'page' : undefined} title={!expanded ? label : undefined} className={cardClass(active)}><span className={`flex items-center ${expanded ? 'gap-3' : 'justify-center w-full'}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-50"><Icon className="h-4 w-4" /></span>{expanded && <span className="text-sm font-medium">{label}</span>}</span>{expanded && <ChevronRight className="h-4 w-4 text-zinc-300" />}</Link>)}
        </nav>
        <div className="mt-auto space-y-2 border-t border-zinc-100 pt-4">
          <button type="button" title={!expanded ? 'Configurações' : undefined} className={cardClass(false)}><span className={`flex items-center ${expanded ? 'gap-3' : 'justify-center w-full'}`}><span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-50"><Settings2 className="h-4 w-4" /></span>{expanded && <span className="text-sm font-medium">Configurações</span>}</span></button>
          <div className={`flex items-center ${expanded ? 'justify-between' : 'justify-center'} rounded-lg px-1 py-1`}><ModeToggle />{expanded && <UserMenu />}</div>
          {!expanded && <div className="flex justify-center"><UserMenu compact /></div>}
        </div>
      </aside>
      <main className={`${sidebarWidth} min-h-screen transition-[margin-left] duration-200`}>{children}</main>
    </div>
  );
}
