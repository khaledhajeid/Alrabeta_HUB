import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";

export const jetbrainsMono = localFont({
  src: [
    { path: "./jbm-reg.woff2", weight: "400", style: "normal" },
    { path: "./jbm-bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

// Geist — Vercel's own typeface, matching the Vercel/Linear/Raycast
// register the rebrand is built around. Self-hosted via the `geist`
// package's own next/font/local call rather than reimplemented here, so it
// stays correct against however the package lays out its font files
// internally. Its built-in --font-geist-sans variable is remapped to
// --font-sans in globals.css, replacing IBM Plex Sans.
export const geistSans = GeistSans;
