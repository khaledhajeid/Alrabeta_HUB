import localFont from "next/font/local";

export const jetbrainsMono = localFont({
  src: [
    { path: "./jbm-reg.woff2", weight: "400", style: "normal" },
    { path: "./jbm-bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

export const plexSans = localFont({
  src: [
    { path: "./plex-reg.woff2", weight: "400", style: "normal" },
    { path: "./plex-semi.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});
