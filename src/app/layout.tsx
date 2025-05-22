import "./globals.css";
import { ReactNode } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://js.arcgis.com/4.29/esri/themes/light/main.css"
        />
        <script src="https://js.arcgis.com/4.29/"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
