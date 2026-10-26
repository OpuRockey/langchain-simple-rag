import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simple RAG",
  description: "A retrieval-augmented question-answering application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-neutral-100 text-neutral-900">{children}</body>
    </html>
  );
}
