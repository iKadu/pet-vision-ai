"use client";

import { Button } from "@tccpet/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@tccpet/ui/components/dropdown-menu";
import { Check, LaptopMinimal, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useTheme } from "./theme-provider";

const themeOptions = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: LaptopMinimal },
] as const;

export function ModeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const selectedTheme = mounted ? theme ?? "light" : "light";
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
            className="shrink-0 rounded-full border border-border bg-card text-primary shadow-sm transition-[background-color,border-color,color,box-shadow] hover:border-primary/50 hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label={triggerLabel}
            title={triggerLabel}
          />
        }
      >
        <TriggerIcon className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{triggerLabel}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-40 border-border bg-popover p-1 text-popover-foreground"
      >
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            className={`flex items-center gap-2 ${selectedTheme === value ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            onClick={() => setTheme(value)}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{label}</span>
            {selectedTheme === value && <Check className="h-4 w-4" aria-label="Selecionado" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
