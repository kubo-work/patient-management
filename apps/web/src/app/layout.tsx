import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { theme } from "./util/theme";
import "./globals.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Create Next App",
  robots: "noindex",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
        suppressHydrationWarning
      >
        <MantineProvider defaultColorScheme="light" theme={theme}>
          {/* 通知の表示枠は全画面で 1 つだけ置く。画面ごとに置くと、置き忘れた画面では通知が表示されない。 */}
          <Notifications />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
