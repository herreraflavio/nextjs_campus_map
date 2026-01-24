// app/(auth)/layout.tsx
// Shared layout for auth pages: /signin and /register
//
// Place your pages at:
//   app/(auth)/signin/page.tsx
//   app/(auth)/register/page.tsx
//
// This layout provides:
// - Full-screen backdrop image with subtle overlay
// - Centered auth card area (your existing pages render here)
// - Company logo + product tagline (placeholders for now)

import type { ReactNode } from "react";
import { Box, Container, Typography } from "@mui/material";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        // Backdrop image (placeholder)
        backgroundImage:
          'url("https://images.unsplash.com/photo-1526401485004-2aa7d7b1bcd5?auto=format&fit=crop&w=2400&q=80")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Overlay for readability */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(120deg, rgba(0,0,0,0.75), rgba(0,0,0,0.35))",
          zIndex: 0,
        }}
      />

      {/* Subtle vignette */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06), rgba(0,0,0,0) 55%)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      <Container
        maxWidth="lg"
        sx={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 4, md: 10 },
          py: { xs: 6, md: 10 },
        }}
      >
        {/* Brand / Marketing panel */}
        <Box
          sx={{
            flex: 1,
            width: "100%",
            maxWidth: { xs: 520, md: 560 },
            color: "rgba(255,255,255,0.92)",
            textAlign: { xs: "center", md: "left" },
          }}
        >
          {/* Placeholder logo (swap with your own asset later) */}
          <Box
            component="img"
            src="https://dummyimage.com/220x56/ffffff/111111.png&text=Your+Logo"
            alt="Company logo"
            sx={{
              height: 56,
              width: "auto",
              borderRadius: "10px",
              boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
              mb: 3,
              mx: { xs: "auto", md: 0 },
              display: "block",
            }}
          />

          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              fontSize: { xs: "2.0rem", sm: "2.4rem", md: "3.0rem" },
            }}
          >
            Build interactive maps that people actually use.
          </Typography>

          <Typography
            sx={{
              mt: 2,
              maxWidth: 520,
              mx: { xs: "auto", md: 0 },
              color: "rgba(255,255,255,0.78)",
              fontSize: { xs: "1.0rem", md: "1.05rem" },
              lineHeight: 1.6,
            }}
          >
            A focused workspace for creating, sharing, and maintaining
            data-driven interactive maps—fast to publish, easy to update.
          </Typography>

          {/* Optional feature bullets */}
          <Box
            sx={{
              mt: 4,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
              maxWidth: 560,
              mx: { xs: "auto", md: 0 },
            }}
          >
            {[
              {
                title: "API-driven layers",
                desc: "Bring live datasets onto maps.",
              },
              {
                title: "Simple publishing",
                desc: "Share in seconds, iterate daily.",
              },
              {
                title: "Fast performance",
                desc: "Optimized for real-world usage.",
              },
              { title: "Secure access", desc: "Keep private maps private." },
            ].map((item) => (
              <Box
                key={item.title}
                sx={{
                  borderRadius: "18px",
                  p: 2.2,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
                  {item.title}
                </Typography>
                <Typography
                  sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.95rem" }}
                >
                  {item.desc}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Auth form slot */}
        <Box
          sx={{
            flex: 1,
            width: "100%",
            maxWidth: 480,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {/* Your /signin or /register page content will render here */}
          {children}
        </Box>
      </Container>

      {/* Footer */}
      <Box
        sx={{
          position: "absolute",
          bottom: 18,
          left: 0,
          right: 0,
          zIndex: 1,
          px: 2,
          textAlign: "center",
          color: "rgba(255,255,255,0.65)",
          fontSize: "0.9rem",
        }}
      >
        © {new Date().getFullYear()} Your Company. All rights reserved.
      </Box>
    </Box>
  );
}
