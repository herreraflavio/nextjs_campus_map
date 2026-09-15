//src/app/components/LoggedInDashboard.jsx
"use client";

import React, { useCallback, useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AppBar,
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Box,
  Button,
} from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";

import SaveMap from "@/app/components/button/SaveMap";
import ShareMap from "@/app/components/button/ShareMap";
import SketchTool from "@/app/components/map/admin/SketchTool";
import AdminSidebar from "./map/admin/AdminSidebar";
import ArcGISWrapper from "@/app/components/ArcGISWrapper";
import AddEvent from "./map/admin/AddEvent";
import EventsDashboard from "./map/admin/EventsDashboard";

/** Memoize map wrapper so header/menu state changes don't cause map rerenders */
const MemoArcGISWrapper = React.memo(ArcGISWrapper);

function DashboardHeader({ email }) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState(null);

  const menuOpen = Boolean(anchorEl);

  const onMenuOpen = useCallback((e) => {
    setAnchorEl(e.currentTarget);
  }, []);

  const onMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const onLogout = useCallback(async () => {
    setAnchorEl(null);
    await signOut({ redirect: false });
    router.replace("/");
    router.refresh();
  }, [router]);

  return (
    <AppBar position="static" sx={{ backgroundColor: "#ffffffff" }}>
      <Toolbar>
        <Button
          component={Link}
          href="/"
          color="inherit"
          sx={{ fontSize: 18, textTransform: "none", gap: 1 }}
        >
          <img src="/branding/logo3.png" alt="Home" style={{ height: 36 }} />
        </Button>

        <Typography component="div" variant="h6" sx={{ flexGrow: 1 }}>
          <Box sx={{ p: 2, display: "flex", justifyContent: "center", gap: 2 }}>
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
          open={menuOpen}
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
            {email ?? "Signed in"}
          </MenuItem>

          <MenuItem
            onClick={onLogout}
            sx={{
              backgroundColor: "rgba(0,0,0,0.08)",
              "&:hover": { backgroundColor: "rgba(0,0,0,0.15)" },
            }}
          >
            Sign Out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

export default function LoggedInDashboard({ user }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <DashboardHeader email={user?.email} />

      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          overflow: "hidden",
          flexDirection: { xs: "column", md: "row" },
        }}
      >
        <Box
          sx={{
            width: { xs: "100%", md: 350 },
            flex: { xs: "0 0 34vh", md: "0 0 350px" },
            order: { xs: 2, md: 1 },
            display: "flex",
            flexDirection: "column",
            height: { xs: "auto", md: "100%" },
            overflowY: "auto",
            borderTop: {
              xs: "1px solid rgba(0,0,0,0.12)",
              md: "none",
            },
          }}
        >
          <AdminSidebar />
        </Box>

        <Box
          sx={{
            flexGrow: 1,
            flex: "1 1 auto",
            order: { xs: 1, md: 2 },
            height: { xs: "auto", md: "100%" },
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative" }}>
            <AddEvent />
          </div>
          <div style={{ position: "relative" }}>
            <EventsDashboard />
          </div>

          <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
            <MemoArcGISWrapper includeAdminHiddenCategories />

            <div>
              <div style={crosshairWrap} aria-hidden="true">
                <div style={crosshairH} />
                <div style={crosshairV} />
                <div style={crosshairDot} />
              </div>

              <div style={cornersWrap} aria-hidden="true">
                <div style={{ ...cornerBox, ...cornerTL }}>
                  <div style={{ ...cornerH, ...hTop }} />
                  <div style={{ ...cornerV, ...vLeft }} />
                </div>
                <div style={{ ...cornerBox, ...cornerTR }}>
                  <div style={{ ...cornerH, ...hTop }} />
                  <div style={{ ...cornerV, ...vRight }} />
                </div>
                <div style={{ ...cornerBox, ...cornerBL }}>
                  <div style={{ ...cornerH, ...hBottom }} />
                  <div style={{ ...cornerV, ...vLeft }} />
                </div>
                <div style={{ ...cornerBox, ...cornerBR }}>
                  <div style={{ ...cornerH, ...hBottom }} />
                  <div style={{ ...cornerV, ...vRight }} />
                </div>
              </div>
            </div>
          </div>
        </Box>
      </Box>
    </Box>
  );
}

const crosshairWrap = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: 34,
  height: 34,
  zIndex: 1500,
  pointerEvents: "none",
};

const backdropInvert = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "invert(1)",
  WebkitBackdropFilter: "invert(1)",
};

const crosshairH = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "50%",
  height: 3,
  transform: "translateY(-50%)",
  borderRadius: 999,
  ...backdropInvert,
};

const crosshairV = {
  position: "absolute",
  top: 0,
  bottom: 0,
  left: "50%",
  width: 3,
  transform: "translateX(-50%)",
  borderRadius: 999,
  ...backdropInvert,
};

const crosshairDot = {
  position: "absolute",
  left: "50%",
  top: "50%",
  width: 8,
  height: 8,
  transform: "translate(-50%, -50%)",
  borderRadius: "50%",
  ...backdropInvert,
};

const CORNER_PAD = 60;
const CORNER_LEN = 26;
const CORNER_THICK = 3;

const cornersWrap = {
  position: "absolute",
  inset: 0,
  zIndex: 1490,
  pointerEvents: "none",
};

const cornerBox = {
  position: "absolute",
  width: CORNER_LEN,
  height: CORNER_LEN,
};

const cornerTL = { top: CORNER_PAD, left: CORNER_PAD };
const cornerTR = { top: CORNER_PAD, right: CORNER_PAD };
const cornerBL = { bottom: CORNER_PAD, left: CORNER_PAD };
const cornerBR = { bottom: CORNER_PAD, right: CORNER_PAD };

const invertInk = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "invert(1)",
  WebkitBackdropFilter: "invert(1)",
  borderRadius: 999,
};

const cornerH = {
  position: "absolute",
  left: 0,
  right: 0,
  height: CORNER_THICK,
  ...invertInk,
};

const cornerV = {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: CORNER_THICK,
  ...invertInk,
};

const hTop = { top: 0 };
const hBottom = { bottom: 0 };

const vLeft = { left: 0 };
const vRight = { right: 0 };
