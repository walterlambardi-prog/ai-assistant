"use client";
import { useState } from "react";
import VoiceRecorder from "./VoiceRecorder";

type Props = {
  disabled: boolean;
  loading: boolean;
  onSendText: (text: string) => void;
  onSendVoice: (blob: Blob) => void;
};

export default function MessageInput({ disabled, loading, onSendText, onSendVoice }: Props) {
  const [text, setText] = useState("");

  function submit() {
    const t = text.trim();
    if (!t) return;
    onSendText(t);
    setText("");
  }

  return (
    <div className="input-bar">
      <textarea
        rows={1}
        placeholder="Escribí un mensaje…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        disabled={disabled}
      />
      <VoiceRecorder disabled={disabled} onRecorded={onSendVoice} />
      <button onClick={submit} disabled={disabled || !text.trim()} className="primary">
        {loading ? "…" : "Enviar"}
      </button>
    </div>
  );
}
