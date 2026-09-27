"use client";

import { Button } from "@tccpet/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@tccpet/ui/components/dropdown-menu";
import { Check, LaptopMinimal, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

const themeOptions = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: LaptopMinimal },
] as const;

export function ModeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const selectedTheme = mounted ? theme ?? "system" : "system";
  const triggerLabel = useMemo(() => {
    const selected = themeOptions.find(({ value }) => value === selectedTheme);
    return `Tema: ${selected?.label ?? "Sistema"}`;
  }, [selectedTheme]);
  const TriggerIcon = selectedTheme === "system"
    ? LaptopMinimal
    : resolvedTheme === "dark"
      ? Moon
      : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            aria-label={triggerLabel}
            title={triggerLabel}
          />
        }
      >
        <TriggerIcon className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{triggerLabel}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-40 p-1">
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            className="flex items-center gap-2"
            onClick={() => setTheme(value)}
          >
            <Icon className="h-4 w-4 text-zinc-500" />
            <span className="flex-1">{label}</span>
            {selectedTheme === value && <Check className="h-4 w-4" aria-label="Selecionado" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
