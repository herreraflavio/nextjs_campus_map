"use client";

import { Box, Checkbox, FormControlLabel, Typography } from "@mui/material";

export default function VisibilitySettings({
  adminVisible, alwaysVisible, inherited = false, onAdminVisibleChange, onAlwaysVisibleChange,
}: {
  adminVisible: boolean;
  alwaysVisible: boolean;
  inherited?: boolean;
  onAdminVisibleChange: (visible: boolean) => void;
  onAlwaysVisibleChange: (visible: boolean) => void;
}) {
  const locked = alwaysVisible || inherited;
  return (
    <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap" }}>
      <FormControlLabel
        control={<Checkbox checked={locked || adminVisible} disabled={locked}
          onChange={event => onAdminVisibleChange(event.target.checked)} />}
        label="Visible to users"
      />
      <FormControlLabel
        control={<Checkbox checked={alwaysVisible || inherited} disabled={inherited}
          onChange={event => {
            onAlwaysVisibleChange(event.target.checked);
            if (event.target.checked) onAdminVisibleChange(true);
          }} />}
        label="Always remain visible"
      />
      {locked && <Typography variant="caption" color="text.secondary">
        {inherited ? "Always visible because of its category." : "Stays visible in location links and cannot be hidden by users."}
      </Typography>}
    </Box>
  );
}
