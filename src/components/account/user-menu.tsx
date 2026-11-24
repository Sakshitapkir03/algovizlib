"use client";

import { ChartNoAxesColumn, LogIn, LogOut, RotateCcw, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase();
}

/** Guests: "Sign in". Signed in: an avatar menu with My progress, Review, Account, and Sign out. */
export function UserMenu() {
  const { data, status } = useSession();
  const pathname = usePathname();
  // While the session loads, hold the space of "Sign in" (what most visitors get), so the header doesn't shift.
  if (status === "loading")
    return (
      <span
        aria-hidden
        className="invisible inline-flex h-7 items-center border border-transparent px-2.5 text-[0.8rem]"
      >
        <LogIn className="size-3.5 min-[360px]:hidden" />
        <span className="max-[359px]:hidden">Sign in</span>
      </span>
    );
  if (!data?.user) {
    const callback =
      pathname && !pathname.startsWith("/login") ? `?callbackUrl=${encodeURIComponent(pathname)}` : "";
    return (
      <Button asChild variant="outline" size="sm">
        <Link href={`/login${callback}`}>
          {/* Below 360px the header has no room for the word: the icon stays, the name is still "Sign in". */}
          <LogIn aria-hidden className="min-[360px]:hidden" />
          <span className="max-[359px]:sr-only">Sign in</span>
        </Link>
      </Button>
    );
  }
  const { name, email, image } = data.user;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={`Account menu for ${name || email}`}
        >
          <Avatar className="size-7">
            {image && <AvatarImage src={image} alt="" />}
            <AvatarFallback className="font-mono text-[11px]">{initials(name, email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" portal={false} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{name || "Signed in"}</span>
          <span className="block truncate font-mono text-[11px] text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/me">
            <ChartNoAxesColumn aria-hidden /> My progress
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/review">
            <RotateCcw aria-hidden /> Review
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserRound aria-hidden /> Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut({ redirectTo: "/" })}>
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
