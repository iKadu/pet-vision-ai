"use client";
import { Search } from "lucide-react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white px-4 py-3 text-zinc-600 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
        <label className="relative flex min-w-0 max-w-md flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-400" />
          <input type="search" aria-label="Pesquisar no PetVision" placeholder="Pesquisar" className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-900 outline-none transition-[border-color,box-shadow] placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-100" />
        </label>
        <div className="flex shrink-0 items-center gap-3">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
