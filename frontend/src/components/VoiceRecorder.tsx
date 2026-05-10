"use client";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  disabled: boolean;
  onRecorded: (blob: Blob) => void;
};

export default function VoiceRecorder({ disabled, onRecorded }: Readonly<Props>) {
  const { t } = useI18n();
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((tr) => tr.stop());
        onRecorded(blob);
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      alert(t("voiceRecorder.noMic") + (err as Error).message);
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      disabled={disabled}
      onClick={recording ? stop : start}
      title={recording ? t("voiceRecorder.stop") : t("voiceRecorder.record")}
      className={cn(
        "h-9 w-9 shrink-0",
        recording && "text-destructive hover:text-destructive animate-pulse"
      )}
    >
      {recording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}
