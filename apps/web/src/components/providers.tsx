"use client";

import { Toaster } from "@tccpet/ui/components/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { queryClient } from "@/utils/trpc";

import { ThemeProvider, useTheme } from "./theme-provider";

function ThemeAwareToaster() {
  const { resolvedTheme } = useTheme();

  return <Toaster richColors theme={resolvedTheme} />;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools />
        <ThemeAwareToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
