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
} from "@mui/material";

// SIMPLIFIED PARTNER COMPONENT
function PartnerLogoCard({ name, src, href }) {
  const [imgOk, setImgOk] = useState(true);

  const isLink = Boolean(href) && href !== "#";

  return (
    <Box
      component={isLink ? "a" : "div"}
      href={isLink ? href : undefined}
      target={isLink ? "_blank" : undefined}
      rel={isLink ? "noopener noreferrer" : undefined}
      aria-label={isLink ? `Open ${name} in a new tab` : undefined}
      sx={{
        width: { xs: 140, sm: 180 },
        height: { xs: 80, sm: 180 },
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 2,
        border: "1px solid rgba(0,0,0,0.08)",
        backgroundColor: "#fff",
        transition: "all 0.2s ease",
        textDecoration: "none",
        overflow: "hidden",
        cursor: isLink ? "pointer" : "default",

        "&:hover": {
          borderColor: "rgba(0,0,0,0.2)",
          backgroundColor: "rgba(0,0,0,0.01)",
        },
      }}
    >
      {imgOk ? (
        <Box
          component="img"
          src={src}
          alt={name}
          loading="lazy"
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
          }}
          onError={() => setImgOk(false)}
        />
      ) : (
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            color: "rgba(0,0,0,0.4)",
            textAlign: "center",
            px: 1,
            fontSize: "0.8rem",
          }}
        >
          {name}
        </Typography>
      )}
    </Box>
  );
}

export default function LandingPage() {
  const toolbarHeights = { xs: 64, sm: 72 };

  const slides = useMemo(
    () => [
      { src: "/landingpage/ss1.png", alt: "Screenshot 1" },
      { src: "/landingpage/ss2.png", alt: "Screenshot 2" },
      { src: "/landingpage/ss3.png", alt: "Screenshot 3" },
      { src: "/landingpage/ss4.png", alt: "Screenshot 4" },
    ],
    [],
  );

  const partners = useMemo(
    () => [
      {
        name: "Partner A",
        src: "/landingpage/Map UC Merced.png",
        href: "https://campusmap.ucmercedhub.com/",
      },
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
      {/* NAVBAR */}
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
                src="/branding/logo.png"
                alt="Company logo"
                sx={{
                  height: 67,
                  width: "auto",
                }}
              />
            </Box>

            <Box sx={{ flex: 1 }} />

            <Stack direction="row" spacing={1}>
              <Button
                component="a"
                href="#product"
                variant="text"
                sx={{ fontWeight: 800 }}
              >
                Product
              </Button>

              <Button
                component="a"
                href="#partners"
                variant="text"
                sx={{ fontWeight: 800 }}
              >
                Partners
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
                sx={{
                  fontWeight: 900,
                  borderRadius: 999,
                }}
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
              gridTemplateColumns: {
                xs: "1fr",
                md: "1.1fr 0.9fr",
              },
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
                  fontSize: {
                    xs: "2.4rem",
                    sm: "3.0rem",
                    md: "3.6rem",
                  },
                }}
              >
                Build, publish, and maintain interactive maps.
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
                  sx={{
                    borderRadius: 999,
                    fontWeight: 900,
                  }}
                >
                  Get started
                </Button>
              </Stack>
            </Box>

            {/* Hero Video Card */}
            <Card
              sx={{
                borderRadius: 4,
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 14px 40px rgba(0,0,0,0.12)",
              }}
            >
              <Box
                component="video"
                src="/landingpage/mapbuilder_trimed.mp4"
                autoPlay
                muted
                loop
                playsInline
                controls={false}
                sx={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  objectFit: "cover",
                  borderRadius: 3,
                  boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
                  backgroundColor: "rgba(0,0,0,0.06)",
                }}
              />
            </Card>
          </Box>
        </Container>
      </Box>

      {/* PRODUCT / FEATURES */}
      <Container
        id="product"
        maxWidth="lg"
        sx={{
          py: { xs: 7, md: 9 },
        }}
      >
        <Typography
          sx={{
            fontWeight: 950,
            letterSpacing: "-0.03em",
            fontSize: "2rem",
          }}
        >
          Product highlights
        </Typography>

        <Box
          sx={{
            mt: 4,
            display: "grid",

            // Mobile = vertical stack
            // Tablet/Desktop = 2 × 2
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
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
              title: "Extensible",
              desc: "Build toward digital twin workflows.",
            },
          ].map((feature) => (
            <Card
              key={feature.title}
              sx={{
                height: "100%",
                borderRadius: 4,
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 10px 26px rgba(0,0,0,0.06)",
              }}
            >
              <CardContent>
                <Typography
                  sx={{
                    fontWeight: 950,
                  }}
                >
                  {feature.title}
                </Typography>

                <Typography
                  sx={{
                    mt: 0.75,
                    color: "rgba(0,0,0,0.70)",
                    lineHeight: 1.65,
                  }}
                >
                  {feature.desc}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>

      {/* SLIDESHOW */}
      <Container
        maxWidth="lg"
        sx={{
          pt: 0,
          pb: { xs: 7, md: 9 },
        }}
      >
        <Box
          sx={{
            mt: 4,
            borderRadius: 4,
            overflow: "hidden",
            border: "1px solid rgba(0,0,0,0.10)",
            boxShadow: "0 18px 55px rgba(0,0,0,0.10)",
            backgroundColor: "rgba(0,0,0,0.02)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
          }}
        >
          {!slideError ? (
            <Box
              component="img"
              src={slides[active]?.src}
              alt={slides[active]?.alt}
              sx={{
                width: "711px",
                maxWidth: "100%",
                height: "622px",
                objectFit: "cover",
                display: "block",
              }}
              onError={() => setSlideError(true)}
            />
          ) : (
            <Box
              sx={{
                height: {
                  xs: 260,
                  sm: 380,
                  md: 460,
                },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 3,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 900,
                  color: "rgba(0,0,0,0.55)",
                }}
              >
                Screenshot placeholder (add images in /public/landingpage)
              </Typography>
            </Box>
          )}

          <Box
            sx={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: { xs: 2, sm: 3 },
              py: 2,
              borderTop: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                size="small"
                sx={{
                  borderRadius: 999,
                  fontWeight: 900,
                }}
                onClick={() =>
                  setActive((a) => (a - 1 + slides.length) % slides.length)
                }
              >
                Prev
              </Button>

              <Button
                variant="contained"
                size="small"
                sx={{
                  borderRadius: 999,
                  fontWeight: 900,
                }}
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
          sx={{
            mt: 2,
            justifyContent: "center",
          }}
        >
          {slides.map((_, i) => (
            <Box
              key={i}
              onClick={() => setActive(i)}
              role="button"
              aria-label={`Show screenshot ${i + 1}`}
              sx={{
                width: 10,
                height: 10,
                borderRadius: 999,
                cursor: "pointer",
                border: "1px solid rgba(0,0,0,0.20)",
                backgroundColor:
                  i === active ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.12)",
              }}
            />
          ))}
        </Stack>
      </Container>

      <Divider />

      {/* PARTNERS */}
      <Container
        id="partners"
        maxWidth="lg"
        sx={{
          py: { xs: 7, md: 9 },
        }}
      >
        <Typography
          sx={{
            fontWeight: 950,
            letterSpacing: "-0.03em",
            fontSize: "2rem",
          }}
        >
          Partners
        </Typography>

        <Box
          sx={{
            mt: 4,
            display: "flex",
            flexWrap: "wrap",
            gap: 3,
            justifyContent: "flex-start",
          }}
        >
          {partners.map((partner) => (
            <PartnerLogoCard
              key={partner.name}
              name={partner.name}
              src={partner.src}
              href={partner.href}
            />
          ))}
        </Box>
      </Container>

      {/* FOOTER */}
      <Box
        component="footer"
        sx={{
          borderTop: "1px solid rgba(0,0,0,0.08)",
          backgroundColor: "#fff",
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            py: { xs: 4, md: 5 },
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "1fr auto 1fr",
              },
              gap: { xs: 3, md: 5 },
              alignItems: "stretch",
            }}
          >
            {/* Social Media */}
            <Box>
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: "1rem",
                  mb: 1,
                }}
              >
                Social Media
              </Typography>

              <Box
                component="a"
                href="https://x.com/logit_solutions"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Logit on X"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  color: "rgba(0,0,0,0.68)",
                  textDecoration: "none",
                  transition: "color 0.2s ease",

                  "&:hover": {
                    color: "text.primary",
                  },

                  "&:hover .social-label": {
                    textDecoration: "underline",
                  },
                }}
              >
                <Box
                  component="img"
                  src="/social/x.svg"
                  alt=""
                  aria-hidden="true"
                  sx={{
                    width: 18,
                    height: 18,
                    display: "block",
                  }}
                />

                <Typography
                  component="span"
                  className="social-label"
                  sx={{
                    fontSize: "inherit",
                  }}
                >
                  @logit_solutions
                </Typography>
              </Box>
            </Box>

            {/* Desktop vertical divider */}
            <Divider
              orientation="vertical"
              flexItem
              sx={{
                display: {
                  xs: "none",
                  md: "block",
                },
              }}
            />

            {/* Mobile horizontal divider */}
            <Divider
              sx={{
                display: {
                  xs: "block",
                  md: "none",
                },
              }}
            />

            {/* Contact */}
            <Box>
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: "1rem",
                  mb: 1,
                }}
              >
                Contact
              </Typography>

              <Typography
                component="a"
                href="mailto:herreraflavio0@gmail.com"
                sx={{
                  color: "rgba(0,0,0,0.68)",
                  textDecoration: "none",
                  transition: "color 0.2s ease",

                  "&:hover": {
                    color: "text.primary",
                    textDecoration: "underline",
                  },
                }}
              >
                herreraflavio0@gmail.com
              </Typography>
            </Box>
          </Box>

          {/* Copyright */}
          <Typography
            sx={{
              mt: 4,
              pt: 3,
              borderTop: "1px solid rgba(0,0,0,0.06)",
              color: "rgba(0,0,0,0.55)",
              textAlign: "center",
              fontSize: "0.875rem",
            }}
          >
            © {new Date().getFullYear()} Logit. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
