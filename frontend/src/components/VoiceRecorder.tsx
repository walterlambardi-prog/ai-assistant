"use client";
import { useRef, useState } from "react";

type Props = {
  disabled: boolean;
  onRecorded: (blob: Blob) => void;
};

export default function VoiceRecorder({ disabled, onRecorded }: Props) {
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
        stream.getTracks().forEach((t) => t.stop());
        onRecorded(blob);
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      alert("No se pudo acceder al micrófono: " + (err as Error).message);
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={recording ? "recording" : ""}
      onClick={recording ? stop : start}
      title={recording ? "Detener" : "Grabar voz"}
    >
      {recording ? "■" : "🎤"}
    </button>
  );
}
