"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const ORDER = ["system", "light", "dark"] as const;
type Mode = (typeof ORDER)[number];

const LABEL: Record<Mode, string> = {
  system: "Theme: system",
  light: "Theme: light",
  dark: "Theme: dark",
};

const subscribe = () => () => {};

/** Cycles system → light → dark. Renders a neutral icon until mounted. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const mode: Mode =
    mounted && (ORDER as readonly string[]).includes(theme ?? "") ? (theme as Mode) : "system";
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`${LABEL[mode]}. Switch to ${next}.`}
      title={`${LABEL[mode]} (click for ${next})`}
    >
      <Icon aria-hidden />
    </Button>
  );
}
