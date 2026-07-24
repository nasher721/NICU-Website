import "../src/styles.css";
import LegacyHashRedirect from "../src/routing/LegacyHashRedirect";

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Source+Serif+4:ital,wght@0,400;0,500;0,600;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LegacyHashRedirect />
        {children}
      </body>
    </html>
  );
}
