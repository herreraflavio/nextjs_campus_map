// /app/layout.jsx

import "./globals.css";
import Script from "next/script";
import { SessionProvider } from "next-auth/react";

export default function RootLayout({ children }) {
  /*
   * ArcGIS API key:
   * This key is used client-side by the ArcGIS JavaScript API, so it cannot
   * be treated as a true secret. NEXT_PUBLIC_ exposure is expected here.
   *
   * Security should instead be enforced through ArcGIS API key restrictions,
   * especially HTTP referrer / allowed-domain restrictions for the production
   * domains that are permitted to use this key.
   */
  const apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY ?? "";

  return (
    <html lang="en">
      <head>
        {/* ArcGIS JS API CSS */}
        <link
          rel="stylesheet"
          href="https://js.arcgis.com/4.33/esri/themes/light/main.css"
        />

        {/* Load ArcGIS AMD runtime before any map code mounts */}
        <Script
          src="https://js.arcgis.com/4.33/"
          strategy="beforeInteractive"
        />

        {/* Expose the ArcGIS API key for client-side map code */}
        <Script id="arcgis-api-key" strategy="beforeInteractive">
          {`
            window.__ARCGIS_API_KEY__ = ${JSON.stringify(apiKey)};
          `}
        </Script>
      </head>

      <body>
        <SessionProvider>{children}</SessionProvider>

        {/* Privacy-friendly analytics by Plausible */}
        <Script
          src="https://plausible.io/js/pa-4O1jnkC4vGQpMFu1jeqIx.js"
          strategy="afterInteractive"
        />

        <Script id="plausible-init" strategy="afterInteractive">
          {`
            window.plausible =
              window.plausible ||
              function() {
                (plausible.q = plausible.q || []).push(arguments);
              };

            plausible.init =
              plausible.init ||
              function(i) {
                plausible.o = i || {};
              };

            plausible.init();
          `}
        </Script>
      </body>
    </html>
  );
}
