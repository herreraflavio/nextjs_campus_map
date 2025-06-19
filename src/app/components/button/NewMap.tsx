"use client";

import React, { useState } from "react";
import {
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Button,
  Box,
  Tooltip,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";

export default function NewMap(): JSX.Element {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mapName, setMapName] = useState<string>("");

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = (): void => {
    setAnchorEl(null);
    setMapName("");
  };

  const handleCreateMap = (): void => {
    alert(`Creating new map: ${mapName}`);
    handleMenuClose();
  };

  return (
    <>
      <Tooltip title="Create New Map">
        <span
          onClick={handleMenuOpen}
          style={{
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            userSelect: "none",
            backgroundColor: "white",
            color: "black",
            padding: "5px",
            fontSize: "18px",
          }}
        >
          <span style={{ marginRight: 4 }}>New Map</span>
          <IconButton color="inherit" size="large" sx={{ padding: 0 }}>
            <AddCircleOutlineIcon />
          </IconButton>
        </span>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1, // small gap between button and menu
              overflow: "visible",
              "&::before": {
                content: '""',
                display: "block",
                position: "absolute",
                top: "5px",
                left: "50%",
                transform: "translateX(-50%) translateY(-50%)",
                width: 10,
                height: 10,
                backgroundColor: "white",
                borderLeft: "1px solid rgba(255,255,255)",
                borderTop: "1px solid rgba(255,255,255)",
                transformOrigin: "center",
                rotate: "45deg",
                zIndex: 0,
              },
            },
          },
        }}
      >
        {/* <MenuItem disableRipple>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <TextField
              label="Map Name"
              size="small"
              value={mapName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setMapName(e.target.value)
              }
              autoFocus
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleCreateMap}
              disabled={!mapName.trim()}
            >
              Create
            </Button>
          </Box>
        </MenuItem> */}
        <MenuItem
          disableRipple
          sx={{
            backgroundColor: "transparent",
            "&:hover": {
              backgroundColor: "transparent",
            },
            "&.Mui-focusVisible": {
              backgroundColor: "transparent",
            },
            "&.Mui-selected": {
              backgroundColor: "transparent",
              "&:hover": {
                backgroundColor: "transparent",
              },
            },
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <TextField
              label="Map Name"
              size="small"
              value={mapName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setMapName(e.target.value)
              }
              autoFocus
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleCreateMap}
              disabled={!mapName.trim()}
            >
              Create
            </Button>
          </Box>
        </MenuItem>
      </Menu>
    </>
  );
}
