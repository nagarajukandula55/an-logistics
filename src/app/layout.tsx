import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AN Group Logistics",
  description: "Courier partnerships, shipping rates and delivery tracking by AN Group",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-bg text-ink">{children}</body>
    </html>
  );
}
