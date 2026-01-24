"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
  Card,
  CardContent,
  Stack,
  Divider,
  CardActionArea,
} from "@mui/material";

function PartnerLogoCard({ name, src, href }) {
  const [imgOk, setImgOk] = useState(true);

  return (
    <Card
      sx={{
        // UPDATED: Reduced border radius (was 4)
        borderRadius: 2,
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 10px 26px rgba(0,0,0,0.06)",
        overflow: "hidden",
        // UPDATED: Force square aspect ratio
        aspectRatio: "1 / 1",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(0,0,0,0.01))",
      }}
    >
      <CardActionArea
        component={href ? "a" : "div"}
        href={href}
        sx={{
          // UPDATED: Remove fixed height, let aspect-ratio drive it.
          // Remove padding (px, py) so it goes edge-to-edge.
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            width: "100%",
            height: "100%",
            // UPDATED: Removed inner border radius and border to be cleaner
            backgroundColor: "rgba(255,255,255,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle brand-ish sheen */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(900px 140px at 20% 10%, rgba(0,0,0,0.06), transparent 55%)",
              pointerEvents: "none",
            }}
          />

          {imgOk ? (
            <Box
              component="img"
              src={src}
              alt={name}
              loading="lazy"
              sx={{
                // UPDATED: Bigger image limits (was 80% / 64px)
                maxWidth: "85%",
                maxHeight: "85%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                filter: "grayscale(20%) contrast(1.02)",
                opacity: 0.94,
                transition: "transform 200ms ease, opacity 200ms ease",
                ".MuiCardActionArea-root:hover &": {
                  transform: "scale(1.03)",
                  opacity: 1,
                },
              }}
              onError={() => setImgOk(false)}
            />
          ) : (
            <Box
              sx={{
                px: 2,
                textAlign: "center",
              }}
            >
              <Typography
                sx={{
                  fontWeight: 950,
                  letterSpacing: "-0.02em",
                  color: "rgba(0,0,0,0.62)",
                  fontSize: { xs: "0.95rem", sm: "1.0rem" },
                  lineHeight: 1.2,
                }}
              >
                {name}
              </Typography>
              <Typography
                sx={{
                  mt: 0.5,
                  color: "rgba(0,0,0,0.45)",
                  fontSize: "0.85rem",
                }}
              >
                Logo placeholder
              </Typography>
            </Box>
          )}
        </Box>
      </CardActionArea>
    </Card>
  );
}

export default function LandingPage() {
  const toolbarHeights = { xs: 64, sm: 72 };

  // Placeholder screenshots for slideshow
  const slides = useMemo(
    () => [
      { src: "/landingpage/shot1.jpg", alt: "Screenshot 1" },
      { src: "/landingpage/shot2.jpg", alt: "Screenshot 2" },
      { src: "/landingpage/shot3.jpg", alt: "Screenshot 3" },
    ],
    [],
  );

  const partners = useMemo(
    () => [
      {
        name: "Partner A",
        src: "/landingpage/Map UC Merced.png",
        href: "#",
      },
      // You can add more here to see the grid effect
    ],
    [],
  );

  const [active, setActive] = useState(0);
  const [slideError, setSlideError] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [slides.length]);

  useEffect(() => {
    setSlideError(false);
  }, [active]);

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "#fff" }}>
      {/* Navbar (safe, reusable later) */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: "rgba(255,255,255,0.92)",
          color: "text.primary",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Container maxWidth="lg" disableGutters sx={{ px: { xs: 2, sm: 3 } }}>
          <Toolbar disableGutters sx={{ minHeight: toolbarHeights }}>
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
                src="/landingpage/logo.png"
                alt="Company logo"
                sx={{
                  height: 38,
                  width: "auto",
                  borderRadius: "10px",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
                }}
              />
              <Typography
                sx={{
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  display: { xs: "none", sm: "block" },
                }}
              >
                Logit
              </Typography>
            </Box>

            <Box sx={{ flex: 1 }} />

            <Stack direction="row" spacing={1}>
              <Button
                component="a"
                href="#partners"
                variant="text"
                sx={{ fontWeight: 800 }}
              >
                Partners
              </Button>
              <Button
                component="a"
                href="#product"
                variant="text"
                sx={{ fontWeight: 800 }}
              >
                Product
              </Button>
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
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      {/* HERO */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.1fr 0.9fr" },
              gap: { xs: 4, md: 6 },
              alignItems: "center",
            }}
          >
            <Box>
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 950,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.02,
                  fontSize: { xs: "2.4rem", sm: "3.0rem", md: "3.6rem" },
                }}
              >
                Build, publish, and maintain interactive maps—fast.
              </Typography>

              <Typography
                sx={{
                  mt: 2,
                  maxWidth: 640,
                  color: "rgba(0,0,0,0.70)",
                  fontSize: { xs: "1.05rem", md: "1.1rem" },
                  lineHeight: 1.7,
                }}
              >
                Logit is a focused workspace for creating data-driven maps:
                API-fed layers, shareable views, and a clean editing experience.
                Placeholder copy for now—replace with your final positioning
                later.
              </Typography>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ mt: 3 }}
              >
                <Button
                  component={Link}
                  href="/register"
                  variant="contained"
                  size="large"
                  sx={{ borderRadius: 999, fontWeight: 900 }}
                >
                  Get started
                </Button>
                <Button
                  component="a"
                  href="#videos"
                  variant="outlined"
                  size="large"
                  sx={{ borderRadius: 999, fontWeight: 900 }}
                >
                  Watch demo
                </Button>
              </Stack>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2.5}
                sx={{ mt: 4, color: "rgba(0,0,0,0.65)" }}
              >
                {[
                  { k: "Live feeds", v: "API-driven layers" },
                  { k: "Publishing", v: "Shareable map pages" },
                  { k: "Editing", v: "Polygons + popups" },
                ].map((item) => (
                  <Box key={item.k} sx={{ minWidth: 160 }}>
                    <Typography sx={{ fontWeight: 900 }}>{item.k}</Typography>
                    <Typography sx={{ mt: 0.25 }}>{item.v}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>

            {/* Hero right card (placeholder graphic) */}
            <Card
              sx={{
                borderRadius: 4,
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 14px 40px rgba(0,0,0,0.12)",
              }}
            >
              <Box
                sx={{
                  height: { xs: 240, sm: 300, md: 360 },
                  background:
                    "linear-gradient(135deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 3,
                }}
              >
                <Typography
                  sx={{
                    textAlign: "center",
                    fontWeight: 900,
                    color: "rgba(0,0,0,0.55)",
                  }}
                >
                  Placeholder hero mockup / screenshot
                </Typography>
              </Box>
              <CardContent>
                <Typography sx={{ fontWeight: 900 }}>
                  Map Builder Preview
                </Typography>
                <Typography sx={{ mt: 0.5, color: "rgba(0,0,0,0.70)" }}>
                  Swap this card with a real product screenshot when ready.
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Container>
      </Box>

      {/* PRODUCT / FEATURES */}
      <Container id="product" maxWidth="lg" sx={{ py: { xs: 7, md: 9 } }}>
        <Typography
          sx={{ fontWeight: 950, letterSpacing: "-0.03em", fontSize: "2.0rem" }}
        >
          Product highlights
        </Typography>
        <Typography sx={{ mt: 1, color: "rgba(0,0,0,0.70)", maxWidth: 760 }}>
          Placeholder section—use this area for core product messaging and
          primary differentiators.
        </Typography>

        <Box
          sx={{
            mt: 4,
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              md: "1fr 1fr 1fr",
            },
            gap: 2,
          }}
        >
          {[
            {
              title: "API-driven layers",
              desc: "Plug in live datasets and keep maps fresh.",
            },
            {
              title: "Polygons + popups",
              desc: "Draw, annotate, and explain visually.",
            },
            {
              title: "Shareable pages",
              desc: "Publish maps and share a clean URL.",
            },
            {
              title: "Role-based access",
              desc: "Placeholder for permissions and teams.",
            },
            {
              title: "Performance-focused",
              desc: "Optimized for real-world use cases.",
            },
            {
              title: "Extensible",
              desc: "Build toward digital twin workflows.",
            },
          ].map((f) => (
            <Card
              key={f.title}
              sx={{
                borderRadius: 4,
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 10px 26px rgba(0,0,0,0.06)",
              }}
            >
              <CardContent>
                <Typography sx={{ fontWeight: 950 }}>{f.title}</Typography>
                <Typography
                  sx={{ mt: 0.75, color: "rgba(0,0,0,0.70)", lineHeight: 1.65 }}
                >
                  {f.desc}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>

      <Divider />

      {/* VIDEOS */}
      <Container id="videos" maxWidth="lg" sx={{ py: { xs: 7, md: 9 } }}>
        <Typography
          sx={{ fontWeight: 950, letterSpacing: "-0.03em", fontSize: "2.0rem" }}
        >
          Demo videos
        </Typography>
        <Typography sx={{ mt: 1, color: "rgba(0,0,0,0.70)", maxWidth: 760 }}>
          Embed YouTube, Vimeo, or hosted MP4 videos here. The boxes below are
          placeholders.
        </Typography>

        <Box
          sx={{
            mt: 4,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
          }}
        >
          {[0, 1].map((i) => (
            <Box
              key={i}
              sx={{
                borderRadius: 4,
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.10)",
                boxShadow: "0 14px 40px rgba(0,0,0,0.08)",
                background: "rgba(0,0,0,0.03)",
              }}
            >
              {/* Replace this with an <iframe> or <video> */}
              <Box
                sx={{
                  aspectRatio: "16/9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 3,
                }}
              >
                <Typography sx={{ fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>
                  Video embed placeholder
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Container>

      <Divider />

      {/* SLIDESHOW */}
      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 9 } }}>
        <Typography
          sx={{ fontWeight: 950, letterSpacing: "-0.03em", fontSize: "2.0rem" }}
        >
          Screenshots
        </Typography>
        <Typography sx={{ mt: 1, color: "rgba(0,0,0,0.70)", maxWidth: 760 }}>
          A lightweight slideshow for product screenshots. Replace placeholder
          images in <code>/public/landingpage</code>.
        </Typography>

        <Box
          sx={{
            mt: 4,
            borderRadius: 4,
            overflow: "hidden",
            border: "1px solid rgba(0,0,0,0.10)",
            boxShadow: "0 18px 55px rgba(0,0,0,0.10)",
            backgroundColor: "rgba(0,0,0,0.02)",
          }}
        >
          {!slideError ? (
            <Box
              component="img"
              src={slides[active]?.src}
              alt={slides[active]?.alt}
              sx={{
                width: "100%",
                height: { xs: 260, sm: 380, md: 460 },
                objectFit: "cover",
                display: "block",
              }}
              onError={() => setSlideError(true)}
            />
          ) : (
            <Box
              sx={{
                height: { xs: 260, sm: 380, md: 460 },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 3,
              }}
            >
              <Typography sx={{ fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>
                Screenshot placeholder (add images in /public/landingpage)
              </Typography>
            </Box>
          )}

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: { xs: 2, sm: 3 },
              py: 2,
              borderTop: "1px solid rgba(0,0,0,0.08)",
              backgroundColor: "rgba(255,255,255,0.80)",
              backdropFilter: "blur(10px)",
            }}
          >
            <Typography sx={{ fontWeight: 900 }}>
              {slides[active]?.alt || "Screenshot"}
            </Typography>

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                size="small"
                sx={{ borderRadius: 999, fontWeight: 900 }}
                onClick={() =>
                  setActive((a) => (a - 1 + slides.length) % slides.length)
                }
              >
                Prev
              </Button>
              <Button
                variant="contained"
                size="small"
                sx={{ borderRadius: 999, fontWeight: 900 }}
                onClick={() => setActive((a) => (a + 1) % slides.length)}
              >
                Next
              </Button>
            </Stack>
          </Box>
        </Box>

        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 2, justifyContent: "center" }}
        >
          {slides.map((_, i) => (
            <Box
              key={i}
              onClick={() => setActive(i)}
              sx={{
                width: 10,
                height: 10,
                borderRadius: 999,
                cursor: "pointer",
                border: "1px solid rgba(0,0,0,0.20)",
                backgroundColor:
                  i === active ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.12)",
              }}
              aria-label={`Go to slide ${i + 1}`}
              role="button"
            />
          ))}
        </Stack>
      </Container>

      <Divider />

      {/* PARTNERS */}
      <Container id="partners" maxWidth="lg" sx={{ py: { xs: 7, md: 9 } }}>
        <Typography
          sx={{ fontWeight: 950, letterSpacing: "-0.03em", fontSize: "2.0rem" }}
        >
          Partners
        </Typography>

        <Box
          sx={{
            mt: 4,
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              sm: "repeat(3, minmax(0, 1fr))",
              md: "repeat(4, minmax(0, 1fr))",
            },
            gap: { xs: 1.5, sm: 2 },
          }}
        >
          {partners.map((p) => (
            <PartnerLogoCard
              key={p.name}
              name={p.name}
              src={p.src}
              href={p.href}
            />
          ))}
        </Box>
      </Container>

      {/* Footer */}
      <Box
        sx={{
          borderTop: "1px solid rgba(0,0,0,0.06)",
          backgroundColor: "#fff",
        }}
      >
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Typography sx={{ color: "rgba(0,0,0,0.65)", textAlign: "center" }}>
            © {new Date().getFullYear()} Logit. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
