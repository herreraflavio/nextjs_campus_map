// "use client";

// import { signOut } from "next-auth/react";
// import ArcGISWrapper from "@/app/components/ArcGISWrapper";
// import Button from "@/app/components/button/Button";
// import SaveMap from "@/app/components/button/SaveMap";
// import SketchTool from "@/app/components/SketchTool";
// import Sidebar from "./map/Sidebar";

// export default function LoggedInDashboard({ user }) {
//   return (
//     <div
//       className="p-4"
//       style={{ display: "flex", flexDirection: "column", height: "100%" }}
//     >
//       <div>
//         <h1 className="text-2xl font-bold">Welcome, {user.email}</h1>
//         <button
//           onClick={() => signOut()}
//           className="mt-4 bg-red-500 text-white p-2"
//         >
//           Logout
//         </button>
//         <Button />
//         <SaveMap />
//         <SketchTool />
//       </div>
//       <div style={{ flexGrow: "1" }}>
//         <div
//           style={{
//             display: "flex",
//             height: "100%",
//             width: "100%",
//             position: "relative",
//           }}
//         >
//           <div style={{ width: "250px" }}>
//             <Sidebar />
//           </div>
//           <ArcGISWrapper />
//         </div>
//       </div>
//     </div>
//   );
// }

"use client";

import React, { useState } from "react";
import { signOut } from "next-auth/react";
import ArcGISWrapper from "@/app/components/ArcGISWrapper";
import Button from "@/app/components/button/Button";
import SaveMap from "@/app/components/button/SaveMap";
import SketchTool from "@/app/components/SketchTool";
import Sidebar from "./map/Sidebar";
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

export default function LoggedInDashboard({ user }) {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    signOut();
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppBar
        position="static"
        sx={{
          backgroundColor: "#182d4e", // no hover background
        }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            <Box
              sx={{ p: 2, display: "flex", justifyContent: "center", gap: 2 }}
            >
              <Button />
              <SaveMap />
              <SketchTool />
            </Box>
          </Typography>
          <IconButton color="inherit" onClick={handleMenuOpen} size="large">
            <AccountCircleIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem
              disableRipple
              sx={{
                cursor: "default",
                userSelect: "text",
                pointerEvents: "none", // disables hover/click
                backgroundColor: "transparent", // no hover background
                "&:hover": {
                  backgroundColor: "transparent", // prevent hover effect
                },
              }}
            >
              {user.email}
            </MenuItem>

            <MenuItem
              onClick={handleLogout}
              sx={{
                backgroundColor: "rgba(0, 0, 0, 0.08)", // stronger gray
                "&:hover": {
                  backgroundColor: "rgba(0, 0, 0, 0.15)", // slightly darker on hover
                },
              }}
            >
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, display: "flex" }}>
        <Box sx={{ width: 250 }}>
          <Sidebar />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <ArcGISWrapper />
        </Box>
      </Box>
    </Box>
  );
}
