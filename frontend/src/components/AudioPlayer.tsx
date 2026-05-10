"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Download, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AudioState = "idle" | "loading" | "playing" | "paused" | "error";

type Props = {
  src: string;
  className?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEEDS = [1, 1.5, 2, 0.75] as const;
type Speed = (typeof SPEEDS)[number];

// ─── Component ───────────────────────────────────────────────────────────────

export default function AudioPlayer({ src, className }: Readonly<Props>) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const [state, setState] = useState<AudioState>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);

  // ─── Time sync ──────────────────────────────────────────────────────────────

  const syncTime = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    animFrameRef.current = requestAnimationFrame(syncTime);
  }, []);

  const stopSync = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // ─── Audio lifecycle ─────────────────────────────────────────────────────────

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;
    setState("idle");
    setCurrentTime(0);
    setDuration(0);

    const onLoadedMetadata = () => setDuration(audio.duration);
    const onPlaying = () => {
      setState("playing");
      animFrameRef.current = requestAnimationFrame(syncTime);
    };
    const onPause = () => {
      setState("paused");
      stopSync();
      setCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      setState("idle");
      stopSync();
      audio.currentTime = 0;
      setCurrentTime(0);
    };
    const onWaiting = () => setState("loading");
    const onError = () => { setState("error"); stopSync(); };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("error", onError);
      stopSync();
      audioRef.current = null;
    };
  }, [src, syncTime, stopSync]);

  // Apply reactive changes without recreating the audio element
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed]);
  useEffect(() => { if (audioRef.current) audioRef.current.muted = muted; }, [muted]);

  // ─── Seek (click + drag via pointer capture) ─────────────────────────────────

  const seekToRatio = useCallback(
    (clientX: number) => {
      const audio = audioRef.current;
      const track = trackRef.current;
      if (!audio || !track || !Number.isFinite(duration) || duration <= 0) return;
      const { left, width } = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
      audio.currentTime = ratio * duration;
      setCurrentTime(audio.currentTime);
    },
    [duration]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      isDraggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      seekToRatio(e.clientX);
    },
    [seekToRatio]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isDraggingRef.current) seekToRatio(e.clientX);
    },
    [seekToRatio]
  );

  const onPointerUp = useCallback(() => { isDraggingRef.current = false; }, []);

  const onTrackKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      if (!audio) return;
      const step = e.shiftKey ? 10 : 5;
      if (e.key === "ArrowRight") audio.currentTime = Math.min(audio.duration, audio.currentTime + step);
      else if (e.key === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - step);
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); togglePlay(); }
    },
    // togglePlay is stable after mount; disabling exhaustive-deps intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ─── Controls ────────────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state === "playing") audio.pause();
    else audio.play().catch(() => setState("error"));
  }, [state]);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const cycleSpeed = useCallback(
    () => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]),
    []
  );

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isPlaying = state === "playing";
  const isLoading = state === "loading";

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (state === "error") {
    return (
      <p className={cn("text-xs text-destructive", className)}>
        Audio unavailable
      </p>
    );
  }

  return (
    <div
      className={cn(
        "mt-1.5 flex h-9 w-72 max-w-full items-center gap-2 rounded-full border border-border bg-card px-2 shadow-sm",
        className
      )}
    >
      {/* Play / Pause */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        disabled={isLoading}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
          "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        )}
      >
        {isLoading ? (
          <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
        ) : isPlaying ? (
          <Pause className="h-3 w-3 fill-current" />
        ) : (
          <Play className="h-3 w-3 translate-x-px fill-current" />
        )}
      </button>

      {/* Progress bar */}
      <div
        ref={trackRef}
        role="slider"
        aria-label="Seek audio"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onTrackKeyDown}
        className="group relative h-1 flex-1 cursor-pointer touch-none select-none rounded-full bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ml-1"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-primary shadow ring-2 ring-background transition-transform group-hover:scale-100 group-focus-visible:scale-100"
          style={{ left: `${progress}%` }}
        />
      </div>

      {/* Time */}
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {formatTime(currentTime)}
      </span>

      {/* Mute */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
      >
        {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
      </button>

      {/* Speed */}
      <button
        type="button"
        onClick={cycleSpeed}
        aria-label={`Playback speed ${speed}x`}
        className="flex h-6 min-w-[1.75rem] items-center justify-center rounded-md px-1 text-[10px] font-semibold tabular-nums text-muted-foreground transition-colors hover:text-foreground"
      >
        {speed}×
      </button>

      {/* Download */}
      <a
        href={src}
        download
        aria-label="Download audio"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
      >
        <Download className="h-3 w-3" />
      </a>
    </div>
  );
}
