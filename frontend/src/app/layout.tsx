import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "AI Local Assistant",
  description: "Asistente local con Ollama, tools dinámicas y voz.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
