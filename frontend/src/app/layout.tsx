import "./globals.css";
import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n/I18nProvider";

export const metadata = {
  title: "AI Local Assistant",
  description: "Local assistant with Ollama, dynamic tools and voice.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
