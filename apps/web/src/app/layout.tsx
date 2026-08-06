import type { Metadata } from "next";
import { jetbrainsMono, plexSans } from "@/fonts";
import { ThemeScript } from "@/components/theme-script";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alrabeta Hub",
  description: "The Circle's private git-native headquarters.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${jetbrainsMono.variable} h-full`}>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
