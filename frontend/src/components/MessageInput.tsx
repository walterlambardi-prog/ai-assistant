"use client";
import { useState, useRef, useEffect } from "react";
import VoiceRecorder from "./VoiceRecorder";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  disabled: boolean;
  loading: boolean;
  audioPlaying?: boolean;
  onSendText: (text: string) => void;
  onSendVoice: (blob: Blob) => void;
  onStop?: () => void;
  onMuteAudio?: () => void;
};

export default function MessageInput({
  disabled, loading, audioPlaying, onSendText, onSendVoice, onStop, onMuteAudio,
}: Readonly<Props>) {
  const [text, setText] = useState("");
  const { t } = useI18n();
  const taRef = useRef<HTMLTextAreaElement>(null);

  // auto-resize
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [text]);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText("");
  }

  const isBusy = loading || audioPlaying;
  const showStop = loading && onStop;
  const showMute = !loading && audioPlaying && onMuteAudio;

  return (
    <div className="border-t border-border bg-background px-4 pb-4 pt-3">
      <div className="mx-auto max-w-3xl">
        <div
          className={cn(
            "flex items-end gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-sm transition-shadow",
            "focus-within:border-foreground/30 focus-within:shadow-md"
          )}
        >
          <textarea
            ref={taRef}
            rows={1}
            placeholder={
              disabled && !loading ? t("input.placeholderDisabled") : t("input.placeholder")
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={loading}
            className="flex-1 resize-none border-0 bg-transparent px-3 py-2 text-[15px] leading-6 outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-[200px]"
          />
          <VoiceRecorder disabled={disabled || loading} onRecorded={onSendVoice} />
          {showMute && (
            <Button
              size="icon"
              variant="outline"
              onClick={onMuteAudio}
              className="h-9 w-9 rounded-lg shrink-0"
              title={t("header.muteTitle")}
              aria-label={t("header.mute")}
            >
              <VolumeX className="h-4 w-4" />
            </Button>
          )}
          {showStop ? (
            <Button
              size="icon"
              onClick={onStop}
              className="h-9 w-9 rounded-lg shrink-0"
              title={t("header.stopTitle")}
              aria-label={t("header.stop")}
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={submit}
              disabled={disabled || !text.trim() || isBusy}
              className="h-9 w-9 rounded-lg shrink-0"
              aria-label={t("input.send")}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {t("input.hint")}
        </p>
      </div>
    </div>
  );
}
