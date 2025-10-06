// // /app/layout.jsx
// import "./globals.css";
// import { ReactNode } from "react";
// import { SessionProvider } from "next-auth/react";

// export default function RootLayout({ children }) {
//   return (
//     <html lang="en">
//       <head>
//         <link
//           rel="stylesheet"
//           href="https://js.arcgis.com/4.29/esri/themes/light/main.css"
//         />
//         <script src="https://js.arcgis.com/4.29/"></script>
//       </head>
//       <body>
//         <SessionProvider>{children}</SessionProvider>
//       </body>
//     </html>
//   );
// }

// /app/layout.jsx
import "./globals.css";
import Script from "next/script";
import { SessionProvider } from "next-auth/react";

export default function RootLayout({ children }) {
  const apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY ?? "";

  return (
    <html lang="en">
      <head>
        {/* ArcGIS JS API CSS */}
        <link
          rel="stylesheet"
          href="https://js.arcgis.com/4.33/esri/themes/light/main.css"
        />
        {/* Load AMD runtime before any map code mounts */}
        <Script
          src="https://js.arcgis.com/4.33/"
          strategy="beforeInteractive"
        />
        {/* Optional: expose key early if you want to read it from window */}
        <Script id="arcgis-api-key" strategy="beforeInteractive">
          {`window.__ARCGIS_API_KEY__ = ${JSON.stringify(apiKey)};`}
        </Script>
      </head>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
