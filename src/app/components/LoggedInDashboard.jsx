"use client";

import React, { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import {
  AppBar,
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Box,
} from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";

import SaveMap from "@/app/components/button/SaveMap";
import ShareMap from "@/app/components/button/ShareMap";
import SketchTool from "@/app/components/SketchTool";
import Sidebar from "./map/Sidebar";
import ArcGISWrapper from "@/app/components/ArcGISWrapper";

export default function LoggedInDashboard({ user }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const onMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const onMenuClose = () => setAnchorEl(null);
  const onLogout = () => {
    onMenuClose();
    signOut();
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh", // full viewport
      }}
    >
      {/* ===== HEADER ===== */}
      <AppBar position="static" sx={{ backgroundColor: "#182d4e" }}>
        <Toolbar>
          <Link href="/">
            <button style={{ fontSize: 28, cursor: "pointer" }}>
              <img
                src="https://cdn-icons-png.flaticon.com/512/1865/1865269.png"
                alt="Home"
                style={{ width: 30 }}
              />
              Home
            </button>
          </Link>

          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            <Box
              sx={{ p: 2, display: "flex", justifyContent: "center", gap: 2 }}
            >
              <SaveMap />
              <ShareMap />
              <SketchTool />
            </Box>
          </Typography>

          <IconButton color="inherit" onClick={onMenuOpen} size="large">
            <AccountCircleIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={onMenuClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem
              disableRipple
              sx={{
                cursor: "default",
                userSelect: "text",
                pointerEvents: "none",
                backgroundColor: "transparent",
                "&:hover": { backgroundColor: "transparent" },
              }}
            >
              {user.email}
            </MenuItem>
            <MenuItem
              onClick={onLogout}
              sx={{
                backgroundColor: "rgba(0,0,0,0.08)",
                "&:hover": { backgroundColor: "rgba(0,0,0,0.15)" },
              }}
            >
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* ===== BOTTOM ROW: SIDEBAR + MAP ===== */}
      <Box
        sx={{
          flexGrow: 1, // fill remaining after header
          display: "flex",
          overflow: "hidden", // prevent double scrollbars
        }}
      >
        {/* Sidebar: fixed width, scrollable */}
        <Box
          sx={{
            width: 250,
            display: "flex",
            flexDirection: "column",
            height: "100%", // fill this row
            overflowY: "auto", // scroll when content overflows
          }}
        >
          <Sidebar />
        </Box>

        {/* Map: flex-grow, full height */}
        <Box
          sx={{
            flexGrow: 1,
            height: "100%", // fill this row
          }}
        >
          <ArcGISWrapper />
        </Box>
      </Box>
    </Box>
  );
}
