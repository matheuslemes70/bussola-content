"use client";
import React from "react";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function shortLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

export function Linkify({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return React.createElement(
            "a",
            {
              key: i,
              href: part,
              target: "_blank",
              rel: "noopener noreferrer",
              className: "inline-flex items-center rounded bg-bussola-blue/10 px-1.5 py-0.5 text-bussola-blue hover:underline",
            },
            "Link: " + shortLabel(part)
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
