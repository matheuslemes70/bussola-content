import type { Metadata } from "next";
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
