import type { MouseEvent } from "react";

// Shared class strings for the auth pages (login, forgot password) so both
// screens stay visually identical without duplicating constants.

export const authFontStyle = {
  fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif",
} as const;

export const secondaryButton =
  "flex h-10 items-center justify-center gap-2 rounded-lg border border-[#333338] bg-[#0F0F0F] text-[13.5px] font-medium text-[#f2f2f3] transition-colors hover:border-[#4a4a50] hover:bg-[#1c1c1c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#186cee]";

export const inputClass =
  "h-10 w-full rounded-lg border bg-[#171717] px-3.5 text-[14px] text-white outline-none transition-colors placeholder:text-[#6b6b72] focus-visible:outline-none";
export const inputBorder = "border-[#2a2e38] focus:border-[#186cee]";
export const inputBorderError = "border-[#e5484d] focus:border-[#e5484d]";

export const errorText =
  "mt-1.5 flex items-center gap-1.5 text-[12.5px] leading-4 text-[#f87171]";

export const linkClass =
  "font-medium text-[#4d8dff] underline underline-offset-2 hover:text-[#7fabff]";

export const submitButton =
  "mt-6 h-10 w-full rounded-lg bg-[linear-gradient(180deg,#2e83f7_0%,#186cee_48%,#0e5cd6_100%)] text-[14px] font-semibold text-white transition-[filter,opacity] hover:brightness-110 disabled:cursor-default disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#186cee]";

export const preventPlaceholderNav = (event: MouseEvent<HTMLAnchorElement>) => event.preventDefault();
