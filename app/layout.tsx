import type { Metadata } from "next";
import "./globals.css";
import BackgroundMusic from "@/components/BackgroundMusic";
import FullscreenPrompt from "@/components/FullscreenPrompt";

export const metadata: Metadata = {
  title: "MAGGI",
  description: "Escolha um mago, monte sua build e vença a run.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Fonte de títulos (Didone de alto contraste, estilo das referências) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <FullscreenPrompt />
        <BackgroundMusic />
      </body>
    </html>
  );
}
