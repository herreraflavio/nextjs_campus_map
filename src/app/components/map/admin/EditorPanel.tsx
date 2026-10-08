"use client";

import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

// The active category editor's panel, shared without changing its behavior.
export default function EditorPanel({
  title, children, contained = false,
}: { title: string; children: ReactNode; contained?: boolean }) {
  return (
    <Box
      role="dialog"
      aria-label={title}
      sx={{
        position: "absolute",
        top: contained ? { xs: 64, md: 90 } : 90,
        right: contained ? { xs: 8, md: 25 } : 25,
        zIndex: contained ? 10000 : 999,
        bgcolor: "background.paper",
        p: 2,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        borderRadius: 1,
        width: contained ? "min(380px, calc(100% - 16px))" : 380,
        boxSizing: contained ? "border-box" : undefined,
        maxHeight: contained ? "calc(100% - 100px)" : "82vh",
        overflowY: "auto",
      }}
    >
      <Typography variant="h6" sx={{ mb: 1 }}>{title}</Typography>
      {children}
    </Box>
  );
}
