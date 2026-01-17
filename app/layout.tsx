import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BPE Tokenizer Visualizer",
  description: "Interactive visualization of Byte Pair Encoding tokenization",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
