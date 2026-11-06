import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pilot | School Operations",
  description: "A modern school operations platform prototype.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
