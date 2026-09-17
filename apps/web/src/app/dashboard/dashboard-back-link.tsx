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
      className="group inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950"
    >
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      {label}
    </Link>
  );
}
