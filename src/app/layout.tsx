import type { Metadata } from "next";
import { SiteFooter } from "@/app/components/site-footer";
import { SiteHeader } from "@/app/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sunday Rituals | Beauty, made softer",
    template: "%s | Sunday Rituals",
  },
  description:
    "Thoughtful beauty essentials for slower evenings, softer mornings, and the everyday moments that feel like yours.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
