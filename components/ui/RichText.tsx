"use client";

import React from "react";

// Renderiza texto com suporte a **negrito** e URLs clicaveis (compactas).
// Ex: "Envia **hoje** o link: https://drive.google.com/xyz"

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const BOLD_REGEX = /\*\*(.+?)\*\*/g;

function shortLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

function renderLinks(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return React.createElement(
        "a",
        {
          key: `${keyPrefix}-${i}`,
          href: part,
          target: "_blank",
          rel: "noopener noreferrer",
          className:
            "inline-flex items-center rounded bg-bussola-blue/10 px-1.5 py-0.5 text-bussola-blue hover:underline",
        },
        "Link: " + shortLabel(part)
      );
    }
    return React.createElement("span", { key: `${keyPrefix}-${i}` }, part);
  });
}

export function RichText({ text }: { text: string }) {
  if (!text) return null;
  const boldParts = text.split(BOLD_REGEX);
  return (
    <>
      {boldParts.map((part, i) => {
        if (i % 2 === 1) {
          return (
            <strong key={`b-${i}`} className="font-bold text-slate-900">
              {renderLinks(part, `b-${i}`)}
            </strong>
          );
        }
        return <React.Fragment key={`n-${i}`}>{renderLinks(part, `n-${i}`)}</React.Fragment>;
      })}
    </>
  );
}
