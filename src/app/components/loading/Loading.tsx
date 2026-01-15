// Loading.tsx
import React from "react";
import { Box, CircularProgress, Typography } from "@mui/material";

export type LoadingProps = {
  /** Optional text shown under the spinner */
  message?: string;
  /** Spinner size in pixels */
  size?: number;
  /** If true, covers the viewport (useful for route-level loading) */
  fullscreen?: boolean;
  /** If true, adds a subtle backdrop */
  backdrop?: boolean;
};

export default function Loading({
  message = "Loading…",
  size = 36,
  fullscreen = false,
  backdrop = false,
}: LoadingProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: fullscreen ? "fixed" : "relative",
        inset: fullscreen ? 0 : "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: fullscreen ? "100vw" : "100%",
        height: fullscreen ? "100vh" : "100%",
        p: 2,
        ...(backdrop
          ? {
              backgroundColor: "rgba(255, 255, 255, 0.72)",
              backdropFilter: "blur(2px)",
            }
          : {}),
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <CircularProgress size={size} />
        {message ? (
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
