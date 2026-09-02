"use client";

import type { ReactNode } from "react";
import {
  Box,
  Building2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Gem,
  Lightbulb,
  Plug,
  Search,
  SquareTerminal,
} from "lucide-react";
import { PanelToggleIcon } from "@/features/navigation/sidebar-shared";

function SupabaseMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path d="M13.2 2.7 4.1 14.2c-.5.7 0 1.7.9 1.7h7.4l-.7 5.3c-.1.7.8 1 1.2.5l7.6-11.2c.5-.7 0-1.6-.9-1.6h-6.8l.9-5.6c.1-.6-.4-.9-.5-.6Z" fill="#34d399" />
      <path d="M4.1 14.2 11 5.5l-1 7.1h6.2l-3.3 9.1c-.4.5-1.3.2-1.2-.5l.7-5.3H5c-.9 0-1.4-1-.9-1.7Z" fill="#10b981" opacity=".72" />
    </svg>
  );
}

function Slash({ className = "" }: { className?: string }) {
  return <span className={`mx-[10px] text-[13px] text-[#4b4850] ${className}`} aria-hidden="true">/</span>;
}

function Stepper() {
  return (
    <span className="ml-2 inline-flex flex-col text-[#737078]" aria-hidden="true">
      <ChevronUp size={9} strokeWidth={2} />
      <ChevronDown size={9} strokeWidth={2} className="-mt-[2px]" />
    </span>
  );
}

function RoundAction({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-[#343137] text-[#aaa6ae] transition-colors hover:bg-white/[0.04] hover:text-[#edecf1]"
    >
      {children}
    </button>
  );
}

export function TopBar({
  onMenuClick,
  showSidebarToggle = true,
  projectName = "project",
  environment = "production",
}: {
  onMenuClick?: () => void;
  showSidebarToggle?: boolean;
  projectName?: string;
  environment?: string;
}) {
  const toggleSidebar = () => {
    onMenuClick?.();
    window.dispatchEvent(new Event("toggle-desktop-sidebar"));
  };

  const openSearch = () => {
    onMenuClick?.();
    window.dispatchEvent(new Event("open-command-palette"));
  };

  return (
    <header className="sticky top-0 z-[90] flex h-12 w-full items-center border-b border-[#322f37] bg-[#121014] px-3 text-[#edecf1]">
      <div className="flex min-w-0 items-center overflow-hidden">
        {showSidebarToggle ? (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded transition-colors hover:bg-white/[0.05]"
          >
            <SupabaseMark />
          </button>
        ) : (
          <>
            {/* Pages with their own desktop chrome still need a nav opener on
                phones — the application shell's mobile drawer mounts below. */}
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open sidebar"
              aria-haspopup="dialog"
              className="mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#343137] text-[#edecf1] transition-colors hover:bg-white/[0.05] lg:hidden"
            >
              <PanelToggleIcon />
            </button>
            <span
              className="hidden size-6 shrink-0 items-center justify-center lg:inline-flex"
              aria-hidden="true"
            >
              <SupabaseMark />
            </span>
          </>
        )}

        <Slash />

        <div className="hidden min-w-0 items-center sm:flex">
          <Building2 size={14} strokeWidth={1.6} className="mr-2 shrink-0 text-[#8a8791]" aria-hidden="true" />
          <span className="max-w-[230px] truncate text-[13px] font-semibold leading-[18px]">nafiaku447@gmail.com&apos;s Org</span>
          <span className="ml-2 rounded-[5px] border border-[#343137] px-[5px] py-[1px] text-[9px] font-medium leading-[12px] text-[#c5c1c9]">FREE</span>
          <Stepper />
        </div>

        <Slash className="hidden sm:inline" />

        <div className="hidden items-center md:flex">
          <Box size={14} strokeWidth={1.7} className="mr-2 text-[#8a8791]" aria-hidden="true" />
          <span className="text-[13px] font-semibold leading-[18px]">{projectName}</span>
          <Stepper />
        </div>

        <Slash className="hidden md:inline" />

        <div className="hidden items-center lg:flex">
          <span className="text-[13px] font-semibold leading-[18px]">main</span>
          <span className="ml-2 rounded-[5px] border border-[#7a4c00] bg-[#2a1d00] px-[7px] py-[1px] text-[9px] font-medium leading-[13px] tracking-[0.08em] text-[#f59e0b]">{environment.toUpperCase()}</span>
          <Stepper />
        </div>

        <Slash className="hidden lg:inline" />

        <button
          type="button"
          className="hidden h-7 items-center gap-2 rounded-full border border-[#343137] px-3 text-[12px] font-semibold text-[#edecf1] transition-colors hover:bg-white/[0.04] xl:inline-flex"
        >
          <Plug size={13} strokeWidth={1.7} className="text-[#8a8791]" aria-hidden="true" />
          Connect
        </button>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button type="button" className="hidden px-2 text-[12px] text-[#c5c1c9] transition-colors hover:text-[#edecf1] lg:block">Feedback</button>
        <button
          type="button"
          onClick={openSearch}
          className="hidden h-8 w-[136px] items-center rounded-full border border-[#343137] px-[10px] text-left text-[12px] text-[#aaa6ae] transition-colors hover:bg-white/[0.04] md:flex"
          aria-label="Open search"
        >
          <Search size={14} strokeWidth={1.7} className="mr-2 shrink-0" aria-hidden="true" />
          <span>Search...</span>
          <span className="ml-auto text-[10px] text-[#737078]">Ctrl K</span>
        </button>
        <RoundAction label="Help"><CircleHelp size={15} strokeWidth={1.7} /></RoundAction>
        <RoundAction label="Tips"><Lightbulb size={15} strokeWidth={1.7} /></RoundAction>
        <RoundAction label="Terminal"><SquareTerminal size={15} strokeWidth={1.7} /></RoundAction>
        <RoundAction label="Status"><Gem size={15} strokeWidth={1.7} className="text-[#34d399]" /></RoundAction>
        <button
          type="button"
          aria-label="Account"
          className="ml-1 inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#4a474e] bg-[#edecf1]"
        >
          <img alt="Stealth account avatar" src="/stealth-mark.png" className="size-full object-cover" />
        </button>
      </div>
    </header>
  );
}
