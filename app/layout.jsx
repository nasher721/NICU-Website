import { IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import "../src/styles.css";
import LegacyHashRedirect from "../src/routing/LegacyHashRedirect";

const uiFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

const displayFont = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL("https://neurocritical-care-faculty-wiki.nasher721.chatgpt.site"),
  title: "Neurocritical Care Faculty Wiki | Cleveland Clinic",
  description:
    "A searchable, shift-ready faculty orientation resource for Cleveland Clinic neurocritical care at Main Campus and Akron General.",
  icons: {
    icon: "/cleveland-clinic-symbol.png",
    shortcut: "/cleveland-clinic-symbol.png",
  },
  openGraph: {
    type: "website",
    title: "Neurocritical Care Faculty Wiki",
    description:
      "Main Campus + Akron faculty orientation, transformed into one searchable clinical atlas.",
    images: [{ url: "/og.png", width: 1731, height: 909 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Neurocritical Care Faculty Wiki",
    description:
      "Main Campus + Akron faculty orientation, transformed into one searchable clinical atlas.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${uiFont.variable} ${displayFont.variable}`}>
      <body>
        <LegacyHashRedirect />
        {children}
      </body>
    </html>
  );
}
