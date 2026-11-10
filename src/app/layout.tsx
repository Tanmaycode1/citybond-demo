import type { Metadata } from "next";
import { Bebas_Neue, Roboto_Condensed } from "next/font/google";
import "./globals.css";
import "./refinement.css";
import "./brand.css";
import "./blog.css";
import "./original-copy.css";
import "./home-editorial.css";

// Review fallbacks: replace with the supplied ND Logos / Bebas Neue Pro
// webfonts when those separate licensed files are available.
const sans = Roboto_Condensed({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const display = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display-fallback",
  display: "swap",
});
export const metadata: Metadata = {
  title: "CityBond — A new perspective on surfaces",
  description:
    "Explore architectural surfaces through your own perspective. A considered world of panels, louvers, textures and possibilities by CityBond.",
  metadataBase: new URL(process.env.SITE_URL || "https://citybond.in"),
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
