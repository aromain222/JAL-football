import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "JAL Football Ops",
  description: "Transfer recruiting workflow platform for college football staffs."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={GeistSans.className}>{children}</body>
    </html>
  );
}
