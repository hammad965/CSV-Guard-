import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shopify CSV Guard",
  description: "Catch data-loss risks in your Shopify product CSV before you import it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
