import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "MenyaMuhinzi",
  description: "Kinyarwanda vegetable learning for farmers",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="rw">
      <body>{children}</body>
    </html>
  );
}
