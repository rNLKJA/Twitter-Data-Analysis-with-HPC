"use client";

import { Eye, EyeOff, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ANTHROPIC_MODELS, DEFAULT_OPENAI_MODEL } from "@/lib/ai/models";
import { maskKey } from "@/lib/ai/settings";
import { PROVIDER_LABEL, type Provider } from "@/lib/ai/types";

import { useAi } from "./ai-provider";

const toggleOn =
  "data-[state=on]:border-primary/50 data-[state=on]:bg-primary/12 data-[state=on]:text-primary";

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const inputClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

export function AiSettingsDialog({
  onCloseAutoFocus,
}: {
  /** Returns focus to whatever opened the dialog. */
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const { settingsOpen, setSettingsOpen } = useAi();
  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        {/* Remount the form each time the dialog opens so it starts from saved state. */}
        {settingsOpen && <SettingsForm onDone={() => setSettingsOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({ onDone }: { onDone: () => void }) {
  const { prefs, setPrefs, storedKey, savedKeys, saveApiKey, forgetApiKeys } = useAi();
  const otherSaved = (Object.keys(savedKeys) as Provider[]).filter((p) => p !== prefs.provider);
  const anySaved = Object.keys(savedKeys).length > 0;
  const [draftKey, setDraftKey] = useState("");
  const [remember, setRemember] = useState(storedKey?.remembered ?? false);
  const [showKey, setShowKey] = useState(false);
  const [openaiModel, setOpenaiModel] = useState(prefs.openaiModel);
  const id = useId();

  const setProvider = (provider: Provider) => {
    setPrefs({ ...prefs, provider });
    setDraftKey("");
  };

  const save = () => {
    setPrefs({ ...prefs, openaiModel: openaiModel.trim() || DEFAULT_OPENAI_MODEL });
    if (draftKey.trim()) saveApiKey(draftKey, remember);
    else if (storedKey && storedKey.remembered !== remember) saveApiKey(storedKey.key, remember);
    onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" aria-hidden /> AI settings
        </DialogTitle>
        <DialogDescription>
          Optional. The whole site works without a key. With your own key you can ask questions of
          the original results and run the grounding evaluation.
        </DialogDescription>
      </DialogHeader>

      <div className="flex gap-2.5 rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
        <p>
          Your key stays in this browser. Requests go{" "}
          <strong>directly from your browser to {PROVIDER_LABEL[prefs.provider]}</strong>; this site
          is static and has no server that could see the key. It is never logged and never written
          to the AI audit log. Calls are billed to your account by the provider.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <span
            id={`${id}-provider`}
            className="text-xs font-medium text-muted-foreground uppercase"
          >
            Provider
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={prefs.provider}
            onValueChange={(v) => v && setProvider(v as Provider)}
            aria-labelledby={`${id}-provider`}
          >
            <ToggleGroupItem value="anthropic" className={`px-3 text-xs ${toggleOn}`}>
              Anthropic (default)
            </ToggleGroupItem>
            <ToggleGroupItem value="openai" className={`px-3 text-xs ${toggleOn}`}>
              OpenAI
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {prefs.provider === "anthropic" ? (
          <div className="space-y-1.5">
            <span
              id={`${id}-model`}
              className="text-xs font-medium text-muted-foreground uppercase"
            >
              Model
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={prefs.anthropicModel}
              onValueChange={(v) => v && setPrefs({ ...prefs, anthropicModel: v })}
              aria-labelledby={`${id}-model`}
              className="flex-wrap"
            >
              {ANTHROPIC_MODELS.map((m) => (
                <ToggleGroupItem
                  key={m.id}
                  value={m.id}
                  className={`px-3 text-xs ${toggleOn}`}
                  aria-label={`${m.label}, ${m.note}`}
                >
                  {m.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              {capitalise(ANTHROPIC_MODELS.find((m) => m.id === prefs.anthropicModel)?.note ?? "")}.
              Model id <code className="font-mono">{prefs.anthropicModel}</code>.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label
              htmlFor={`${id}-openai-model`}
              className="text-xs font-medium text-muted-foreground uppercase"
            >
              Model id
            </label>
            <input
              id={`${id}-openai-model`}
              value={openaiModel}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setOpenaiModel(e.target.value)}
              placeholder={DEFAULT_OPENAI_MODEL}
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">
              Any Chat Completions model that supports JSON-schema output.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor={`${id}-key`}
            className="text-xs font-medium text-muted-foreground uppercase"
          >
            {PROVIDER_LABEL[prefs.provider]} API key
          </label>
          <div className="flex gap-2">
            <input
              id={`${id}-key`}
              type={showKey ? "text" : "password"}
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder={storedKey ? `Saved: ${maskKey(storedKey.key)}` : "Paste your key"}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={`${id}-key-status`}
              className={inputClass}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? "Hide key" : "Show key"}
            >
              {showKey ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </Button>
          </div>
          <p id={`${id}-key-status`} className="text-xs text-muted-foreground" aria-live="polite">
            {storedKey
              ? storedKey.remembered
                ? `A key (${maskKey(storedKey.key)}) is remembered on this device.`
                : `A key (${maskKey(storedKey.key)}) is saved for this tab only.`
              : `No ${PROVIDER_LABEL[prefs.provider]} key saved.`}
            {otherSaved.map((p) => (
              <span key={p} className="block">
                {PROVIDER_LABEL[p]}: a key ({maskKey(savedKeys[p]!.key)}) is also{" "}
                {savedKeys[p]!.remembered ? "remembered on this device" : "saved for this tab"}.
              </span>
            ))}
          </p>
        </div>

        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="mt-1 size-4 accent-[var(--primary)]"
          />
          <span>
            Remember on this device
            <span className="block text-xs text-muted-foreground">
              Off: kept in session storage and cleared when the tab closes. On: kept in local
              storage until you forget it.
            </span>
          </span>
        </label>
      </div>

      <DialogFooter className="items-stretch sm:items-center">
        {anySaved && (
          <Button
            variant="destructive"
            onClick={() => {
              forgetApiKeys();
              setDraftKey("");
              setRemember(false);
            }}
            className="sm:mr-auto"
          >
            <Trash2 aria-hidden />{" "}
            {Object.keys(savedKeys).length > 1 ? "Forget all keys" : "Forget key"}
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href="/ai-log" onClick={onDone}>
            View AI audit log
          </Link>
        </Button>
        <Button onClick={save}>Save</Button>
      </DialogFooter>
      <p className="-mt-1 text-xs text-muted-foreground">
        What the AI features do and never do:{" "}
        <Link href="/methods#ai-use" onClick={onDone} className="link">
          AI use statement
        </Link>
        .
      </p>
    </>
  );
}
