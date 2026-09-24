import type { Metadata, Viewport } from "next";
import { Cinzel, Quicksand } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jas & Thad's Baby Shower Photo Booth",
  description:
    "Tap, smile, and we'll send your butterfly-framed keepsake straight to your inbox.",
  // Keeps the tablet from showing browser chrome when saved to the home screen.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Photo Booth",
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays enabled so the kiosk still meets WCAG 1.4.4 (Resize Text).
  maximumScale: 5,
  themeColor: "#2b0f47",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${quicksand.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
