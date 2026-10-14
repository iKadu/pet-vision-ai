import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";

type DashboardBackLinkProps = {
  href: Route;
  label: string;
};

export function DashboardBackLink({ href, label }: DashboardBackLinkProps) {
  return (
    <Link
      href={href}
      className="group inline-flex h-9 items-center gap-2 rounded-xl border border-transparent px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-border hover:bg-card hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
      {label}
    </Link>
  );
}
