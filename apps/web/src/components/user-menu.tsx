import { Button } from "@tccpet/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tccpet/ui/components/dropdown-menu";
import { Skeleton } from "@tccpet/ui/components/skeleton";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Link href="/login">
        <Button variant="outline">Sign In</Button>
      </Link>
    );
  }

  const initials = session.user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 gap-2 rounded-lg px-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950" />}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950 text-[10px] font-semibold text-white">{initials}</span>
        <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{session.user.name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-white p-1">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2 px-3 py-2 font-normal text-zinc-500"><UserRound className="h-4 w-4" />Minha conta</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="flex-col items-start gap-0.5 px-3 py-2 text-xs" disabled>
            <span className="font-medium text-zinc-800">{session.user.name}</span>
            <span className="text-zinc-400">{session.user.email}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            className="mt-1 gap-2"
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    router.push("/");
                  },
                },
              });
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
