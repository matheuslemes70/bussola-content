import type { Metadata } from "next";
// Fontes empacotadas no próprio projeto (não dependem do Google na hora do deploy)
import "@fontsource-variable/hanken-grotesk";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bússola — Gestão de Conteúdo",
  description: "Sistema de gestão de conteúdo da agência Bússola",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
