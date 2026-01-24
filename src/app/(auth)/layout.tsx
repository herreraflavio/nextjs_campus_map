// app/(auth)/layout.tsx
// Shared layout for auth pages: /signin and /register

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
} from "@mui/material";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const toolbarHeights = { xs: 64, sm: 72 };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        backgroundImage: 'url("/branding/bg_image.jpg")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Top navigation (white background) */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          backgroundColor: "rgba(255, 255, 255, 1)",
          color: "text.primary",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Container maxWidth="lg" disableGutters sx={{ px: { xs: 2, sm: 3 } }}>
          <Toolbar disableGutters sx={{ minHeight: toolbarHeights }}>
            {/* Logo -> / */}
            <Box
              component={Link}
              href="/"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1.25,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <Box
                component="img"
                src="/branding/logo.png"
                alt="Company logo"
                sx={{
                  height: 67,
                  width: "auto",
                }}
              />
            </Box>

            <Box sx={{ flex: 1 }} />

            {/* Optional right-side nav actions */}
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                component={Link}
                href="/signin"
                variant="text"
                sx={{ fontWeight: 800 }}
              >
                Sign in
              </Button>
              <Button
                component={Link}
                href="/register"
                variant="contained"
                sx={{ fontWeight: 900, borderRadius: 999 }}
              >
                Create account
              </Button>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Offset content under fixed AppBar */}
      <Toolbar sx={{ minHeight: toolbarHeights }} />

      {/* Overlay for readability (stronger, since the image is bright) */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background:
            "linear-gradient(90deg, rgb(8 12 20 / 12%) 0%, rgb(8 12 20 / 25%) 45%, rgb(8 12 20 / 0%) 100%)",
        }}
      />

      {/* Subtle vignette */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
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
        {/* Marketing panel */}
        <Box
          sx={{
            flex: 1,
            width: "100%",
            maxWidth: { xs: 540, md: 600 },
            color: "rgba(255,255,255,0.92)",
            textAlign: { xs: "center", md: "left" },
          }}
        >
          <Typography
            variant="h3"
            sx={{
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              fontSize: { xs: "2.0rem", sm: "2.4rem", md: "3.0rem" },
            }}
          >
            Build interactive maps that people actually use.
          </Typography>

          <Typography
            sx={{
              mt: 2,
              maxWidth: 560,
              mx: { xs: "auto", md: 0 },
              color: "rgba(255,255,255,0.78)",
              fontSize: { xs: "1.0rem", md: "1.05rem" },
              lineHeight: 1.65,
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
              maxWidth: 600,
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
                  backgroundColor: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <Typography sx={{ fontWeight: 800, mb: 0.5 }}>
                  {item.title}
                </Typography>
                <Typography
                  sx={{
                    color: "rgba(255,255,255,0.78)",
                    fontSize: "0.95rem",
                  }}
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
          color: "rgba(255,255,255,0.70)",
          fontSize: "0.9rem",
        }}
      >
        © {new Date().getFullYear()} Logit. All rights reserved.
      </Box>
    </Box>
  );
}
