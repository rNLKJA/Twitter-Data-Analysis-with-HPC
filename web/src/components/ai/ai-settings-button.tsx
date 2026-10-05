"use client";

import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useAi } from "./ai-provider";

/** Header button that opens AI settings; a dot shows when a key is saved. */
export function AiSettingsButton() {
  const { openSettings, storedKey, ready } = useAi();
  const hasKey = ready && !!storedKey;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openSettings}
      aria-label={
        hasKey ? "AI settings (a key is saved)" : "AI settings (optional, bring your own key)"
      }
      title="AI settings"
      className="relative"
    >
      <KeyRound aria-hidden />
      {hasKey && (
        <span aria-hidden className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-success" />
      )}
    </Button>
  );
}
