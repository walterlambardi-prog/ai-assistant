"use client";
import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n/I18nProvider";
import { Mic, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  disabled: boolean;
  onRecorded: (blob: Blob) => void;
};

// ---------------------------------------------------------------------------
// Waveform canvas — reads real frequency data from Web Audio AnalyserNode
// ---------------------------------------------------------------------------
function WaveformCanvas({ analyser }: { analyser: AnalyserNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const BAR_COUNT = 40;
    const GAP = 3;

    function drawRoundedBar(
      c: CanvasRenderingContext2D,
      x: number, y: number, w: number, h: number, r: number,
    ) {
      const rad = Math.min(r, h / 2, w / 2);
      c.beginPath();
      c.moveTo(x + rad, y);
      c.lineTo(x + w - rad, y);
      c.arcTo(x + w, y, x + w, y + rad, rad);
      c.lineTo(x + w, y + h - rad);
      c.arcTo(x + w, y + h, x + w - rad, y + h, rad);
      c.lineTo(x + rad, y + h);
      c.arcTo(x, y + h, x, y + h - rad, rad);
      c.lineTo(x, y + rad);
      c.arcTo(x, y, x + rad, y, rad);
      c.closePath();
      c.fill();
    }

    function tick() {
      rafRef.current = requestAnimationFrame(tick);
      analyser.getByteFrequencyData(data);
      const W = canvas!.width;
      const H = canvas!.height;
      ctx.clearRect(0, 0, W, H);
      const barW = (W - (BAR_COUNT - 1) * GAP) / BAR_COUNT;
      const step = Math.floor(data.length / BAR_COUNT);
      for (let i = 0; i < BAR_COUNT; i++) {
        const v = data[i * step] / 255;
        const barH = Math.max(4, v * H * 0.85);
        const x = i * (barW + GAP);
        const y = (H - barH) / 2;
        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, "rgba(255,255,255,0.25)");
        grad.addColorStop(0.5, "rgba(255,255,255,0.9)");
        grad.addColorStop(1, "rgba(255,255,255,0.25)");
        ctx.fillStyle = grad;
        drawRoundedBar(ctx, x, y, barW, barH, barW / 2);
      }
    }

    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={72}
      className="w-[320px] h-[72px]"
    />
  );
}

// ---------------------------------------------------------------------------
// Overlay that covers the screen while recording
// ---------------------------------------------------------------------------
function VoiceOverlay({
  analyser,
  onStop,
  onCancel,
  t,
}: {
  analyser: AnalyserNode;
  onStop: () => void;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/70 backdrop-blur-sm pb-16">
      <div className="flex flex-col items-center gap-8 animate-fade-in">
        {/* Label */}
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-white/50">
          {t("voiceRecorder.listening")}…
        </p>

        {/* Live waveform */}
        <WaveformCanvas analyser={analyser} />

        {/* Controls */}
        <div className="flex items-center gap-10">
          {/* Cancel — discard */}
          <button
            type="button"
            onClick={onCancel}
            title={t("voiceRecorder.cancel")}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Stop & send — large white circle */}
          <button
            type="button"
            onClick={onStop}
            title={t("voiceRecorder.stop")}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white shadow-xl transition-transform hover:scale-105 active:scale-95"
          >
            <span className="h-[22px] w-[22px] rounded-[4px] bg-black" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Main export — mic button + overlay lifecycle
// ---------------------------------------------------------------------------
export default function VoiceRecorder({ disabled, onRecorded }: Readonly<Props>) {
  const { t } = useI18n();
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const an = audioCtx.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.8;
      source.connect(an);
      setAnalyser(an);

      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onRecorded(blob);
      };
      mr.start();
      recorderRef.current = mr;
    } catch (err) {
      alert(t("voiceRecorder.noMic") + (err as Error).message);
    }
  }

  function cleanup() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    audioCtxRef.current?.close().catch(() => undefined);
    streamRef.current = null;
    audioCtxRef.current = null;
    recorderRef.current = null;
    setAnalyser(null);
  }

  function stopAndSend() {
    recorderRef.current?.stop();
    cleanup();
  }

  function cancel() {
    if (recorderRef.current) {
      // Discard audio — remove listeners before stopping
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    cleanup();
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={start}
        title={t("voiceRecorder.record")}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          "text-muted-foreground transition-colors",
          "hover:bg-accent hover:text-foreground",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <Mic className="h-4 w-4" />
      </button>

      {analyser && (
        <VoiceOverlay
          analyser={analyser}
          onStop={stopAndSend}
          onCancel={cancel}
          t={t}
        />
      )}
    </>
  );
}
