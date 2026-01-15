// "use client";

// import React, { useState } from "react";
// import { signOut } from "next-auth/react";
// import Link from "next/link";
// import {
//   AppBar,
//   Toolbar,
//   IconButton,
//   Menu,
//   MenuItem,
//   Typography,
//   Box,
// } from "@mui/material";
// import AccountCircleIcon from "@mui/icons-material/AccountCircle";

// import SaveMap from "@/app/components/button/SaveMap";
// import ShareMap from "@/app/components/button/ShareMap";
// import SketchTool from "@/app/components/SketchTool";
// import Sidebar from "./map/Sidebar";
// import ArcGISWrapper from "@/app/components/ArcGISWrapper";
// import AddEvent from "./map/MapControls/addEvent";

// export default function LoggedInDashboard({ user }) {
//   const [anchorEl, setAnchorEl] = useState(null);
//   const open = Boolean(anchorEl);
//   const onMenuOpen = (e) => setAnchorEl(e.currentTarget);
//   const onMenuClose = () => setAnchorEl(null);
//   const onLogout = () => {
//     onMenuClose();
//     signOut();
//   };

//   return (
//     <Box
//       sx={{
//         display: "flex",
//         flexDirection: "column",
//         height: "100vh", // full viewport
//       }}
//     >
//       {/* ===== HEADER ===== */}
//       <AppBar position="static" sx={{ backgroundColor: "#182d4e" }}>
//         <Toolbar>
//           <Link href="/">
//             <button style={{ fontSize: 28, cursor: "pointer" }}>
//               <img
//                 src="https://cdn-icons-png.flaticon.com/512/1865/1865269.png"
//                 alt="Home"
//                 style={{ width: 30 }}
//               />
//               Home
//             </button>
//           </Link>

//           <Typography variant="h6" sx={{ flexGrow: 1 }}>
//             <Box
//               sx={{ p: 2, display: "flex", justifyContent: "center", gap: 2 }}
//             >
//               <SaveMap />
//               <ShareMap />
//               <SketchTool />
//             </Box>
//           </Typography>

//           <IconButton color="inherit" onClick={onMenuOpen} size="large">
//             <AccountCircleIcon />
//           </IconButton>
//           <Menu
//             anchorEl={anchorEl}
//             open={open}
//             onClose={onMenuClose}
//             anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
//             transformOrigin={{ vertical: "top", horizontal: "right" }}
//           >
//             <MenuItem
//               disableRipple
//               sx={{
//                 cursor: "default",
//                 userSelect: "text",
//                 pointerEvents: "none",
//                 backgroundColor: "transparent",
//                 "&:hover": { backgroundColor: "transparent" },
//               }}
//             >
//               {user.email}
//             </MenuItem>
//             <MenuItem
//               onClick={onLogout}
//               sx={{
//                 backgroundColor: "rgba(0,0,0,0.08)",
//                 "&:hover": { backgroundColor: "rgba(0,0,0,0.15)" },
//               }}
//             >
//               Logout
//             </MenuItem>
//           </Menu>
//         </Toolbar>
//       </AppBar>

//       {/* ===== BOTTOM ROW: SIDEBAR + MAP ===== */}
//       <Box
//         sx={{
//           flexGrow: 1, // fill remaining after header
//           display: "flex",
//           overflow: "hidden", // prevent double scrollbars
//         }}
//       >
//         {/* Sidebar: fixed width, scrollable */}
//         <Box
//           sx={{
//             width: 250,
//             display: "flex",
//             flexDirection: "column",
//             height: "100%", // fill this row
//             overflowY: "auto", // scroll when content overflows
//           }}
//         >
//           <Sidebar />
//         </Box>

//         {/* Map: flex-grow, full height */}
//         <Box
//           sx={{
//             flexGrow: 1,
//             height: "100%", // fill this row
//             display: "flex",
//             flexDirection: "column",
//           }}
//         >
//           <div style={{ position: "relative" }}>
//             <AddEvent />
//           </div>
//           <div style={{ position: "relative", height: "inherit" }}>
//             <ArcGISWrapper />
//             <div>
//               <div style={crosshairWrap} aria-hidden="true">
//                 <div style={crosshairH} />
//                 <div style={crosshairV} />
//                 <div style={crosshairDot} />
//               </div>
//               {/* Corner brackets overlay */}
//               <div style={cornersWrap} aria-hidden="true">
//                 {/* Top-left */}
//                 <div style={{ ...cornerBox, ...cornerTL }}>
//                   <div style={{ ...cornerH, ...hTop }} />
//                   <div style={{ ...cornerV, ...vLeft }} />
//                 </div>
//                 {/* Top-right */}
//                 <div style={{ ...cornerBox, ...cornerTR }}>
//                   <div style={{ ...cornerH, ...hTop }} />
//                   <div style={{ ...cornerV, ...vRight }} />
//                 </div>
//                 {/* Bottom-left */}
//                 <div style={{ ...cornerBox, ...cornerBL }}>
//                   <div style={{ ...cornerH, ...hBottom }} />
//                   <div style={{ ...cornerV, ...vLeft }} />
//                 </div>
//                 {/* Bottom-right */}
//                 <div style={{ ...cornerBox, ...cornerBR }}>
//                   <div style={{ ...cornerH, ...hBottom }} />
//                   <div style={{ ...cornerV, ...vRight }} />
//                 </div>
//               </div>
//             </div>
//           </div>
//         </Box>
//       </Box>
//     </Box>
//   );
// }

// const crosshairWrap = {
//   position: "absolute",
//   left: "50%",
//   top: "50%",
//   transform: "translate(-50%, -50%)",
//   width: 34,
//   height: 34,
//   zIndex: 1500,
//   pointerEvents: "none",
// };

// // A tiny alpha background is important: many browsers won’t apply backdrop-filter on fully transparent pixels.
// const backdropInvert = {
//   background: "rgba(255,255,255,0.06)",
//   backdropFilter: "invert(1)",
//   WebkitBackdropFilter: "invert(1)",
// };

// const crosshairH = {
//   position: "absolute",
//   left: 0,
//   right: 0,
//   top: "50%",
//   height: 3,
//   transform: "translateY(-50%)",
//   borderRadius: 999,
//   ...backdropInvert,
// };

// const crosshairV = {
//   position: "absolute",
//   top: 0,
//   bottom: 0,
//   left: "50%",
//   width: 3,
//   transform: "translateX(-50%)",
//   borderRadius: 999,
//   ...backdropInvert,
// };

// const crosshairDot = {
//   position: "absolute",
//   left: "50%",
//   top: "50%",
//   width: 8,
//   height: 8,
//   transform: "translate(-50%, -50%)",
//   borderRadius: "50%",
//   ...backdropInvert,
// };

// const CORNER_PAD = 60; // distance from the map container edge
// const CORNER_LEN = 26; // length of each bracket leg
// const CORNER_THICK = 3; // thickness of the bracket leg

// const cornersWrap = {
//   position: "absolute",
//   inset: 0,
//   zIndex: 1490, // keep below your dockWrap (2000), above map
//   pointerEvents: "none",
// };

// // Container for each corner
// const cornerBox = {
//   position: "absolute",
//   width: CORNER_LEN,
//   height: CORNER_LEN,
// };

// // Positions
// const cornerTL = { top: CORNER_PAD, left: CORNER_PAD };
// const cornerTR = { top: CORNER_PAD, right: CORNER_PAD };
// const cornerBL = { bottom: CORNER_PAD, left: CORNER_PAD };
// const cornerBR = { bottom: CORNER_PAD, right: CORNER_PAD };

// // Inverting “ink” (same idea as your crosshair)
// const invertInk = {
//   background: "rgba(255,255,255,0.06)", // keep non-zero alpha so backdrop-filter applies
//   backdropFilter: "invert(1)",
//   WebkitBackdropFilter: "invert(1)",
//   borderRadius: 999,
// };

// // Horizontal/vertical legs
// const cornerH = {
//   position: "absolute",
//   left: 0,
//   right: 0,
//   height: CORNER_THICK,
//   ...invertInk,
// };

// const cornerV = {
//   position: "absolute",
//   top: 0,
//   bottom: 0,
//   width: CORNER_THICK,
//   ...invertInk,
// };

// // Edge variants
// const hTop = { top: 0 };
// const hBottom = { bottom: 0 };

// const vLeft = { left: 0 };
// const vRight = { right: 0 };
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
import SketchTool from "@/app/components/SketchTool";
import Sidebar from "./map/Sidebar";
import ArcGISWrapper from "@/app/components/ArcGISWrapper";
import AddEvent from "./map/MapControls/addEvent";

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
    // Close the menu immediately for UI responsiveness
    setAnchorEl(null);

    // Prevent next-auth from doing a full-page redirect/navigation
    await signOut({ redirect: false });

    // App Router navigation (client-side)
    router.replace("/");
    router.refresh();
  }, [router]);

  return (
    <AppBar position="static" sx={{ backgroundColor: "#182d4e" }}>
      <Toolbar>
        <Button
          component={Link}
          href="/"
          color="inherit"
          sx={{ fontSize: 18, textTransform: "none", gap: 1 }}
        >
          <img
            src="https://cdn-icons-png.flaticon.com/512/1865/1865269.png"
            alt="Home"
            style={{ width: 24, height: 24 }}
          />
          Home
        </Button>

        <Typography variant="h6" sx={{ flexGrow: 1 }}>
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
      {/* ===== HEADER ===== */}
      <DashboardHeader email={user?.email} />

      {/* ===== BOTTOM ROW: SIDEBAR + MAP ===== */}
      <Box sx={{ flexGrow: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar */}
        <Box
          sx={{
            width: 250,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflowY: "auto",
          }}
        >
          <Sidebar />
        </Box>

        {/* Map */}
        <Box
          sx={{
            flexGrow: 1,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative" }}>
            <AddEvent />
          </div>

          <div style={{ position: "relative", height: "inherit" }}>
            <MemoArcGISWrapper />

            <div>
              <div style={crosshairWrap} aria-hidden="true">
                <div style={crosshairH} />
                <div style={crosshairV} />
                <div style={crosshairDot} />
              </div>

              {/* Corner brackets overlay */}
              <div style={cornersWrap} aria-hidden="true">
                {/* Top-left */}
                <div style={{ ...cornerBox, ...cornerTL }}>
                  <div style={{ ...cornerH, ...hTop }} />
                  <div style={{ ...cornerV, ...vLeft }} />
                </div>
                {/* Top-right */}
                <div style={{ ...cornerBox, ...cornerTR }}>
                  <div style={{ ...cornerH, ...hTop }} />
                  <div style={{ ...cornerV, ...vRight }} />
                </div>
                {/* Bottom-left */}
                <div style={{ ...cornerBox, ...cornerBL }}>
                  <div style={{ ...cornerH, ...hBottom }} />
                  <div style={{ ...cornerV, ...vLeft }} />
                </div>
                {/* Bottom-right */}
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

/* ===== overlay styles unchanged ===== */

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

// A tiny alpha background is important: many browsers won’t apply backdrop-filter on fully transparent pixels.
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
