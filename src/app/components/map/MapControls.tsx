// MapControls.tsx
import React, { ReactNode, useEffect, useState } from "react";
import { Box, Typography, TextField, Slider } from "@mui/material";

// 1. Define your center inputs as a 'const' so TS knows field is "x"|"y"
const centerDefs = [
  { label: "X", field: "x", placeholder: "Enter longitude" },
  { label: "Y", field: "y", placeholder: "Enter latitude" },
] as const;

// 2. Extract literal type "x" | "y"
type CenterField = (typeof centerDefs)[number]["field"];

export interface Constraints {
  xmin: string;
  ymin: string;
  xmax: string;
  ymax: string;
}
export interface URLS {
  url: string;
}

interface Props {
  // center
  centerX: string;
  centerY: string;
  onCenterChange: (field: CenterField, value: string) => void;

  cordinates: [number, number];

  // zoom
  zoom: number;
  onZoomChange: (value: number) => void;

  // extent constraints
  constraints: Constraints;
  onConstraintChange: (field: keyof Constraints, value: string) => void;

  // layers: URLS[] | null;
  layers: string[] | null;
  // setLayerURL: (value: number) => void;
  handlelayers: (value: []) => void;
}

// define your extent fields
const constraintFields: Array<{ key: keyof Constraints; label: string }> = [
  { key: "xmin", label: "Min X (xmin)" },
  { key: "ymin", label: "Min Y (ymin)" },
  { key: "xmax", label: "Max X (xmax)" },
  { key: "ymax", label: "Max Y (ymax)" },
];

export default function MapControls({
  centerX,
  centerY,
  cordinates,
  onCenterChange,
  zoom,
  onZoomChange,
  constraints,
  onConstraintChange,
  layers,
  handlelayers,
}: Props) {
  const handleZoomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!isNaN(val)) onZoomChange(val);
  };

  console.log(layers);

  const handleZoomSlider = (
    _: Event | React.SyntheticEvent,
    val: number | number[]
  ) => {
    const v = Array.isArray(val) ? val[0] : val;
    onZoomChange(v);
  };

  const [layerURL, setLayerURL] = useState<string | null>(null);

  function handleChange(e: any) {
    setLayerURL(e.target.value);
  }

  return (
    <Box width="100%">
      {/* --- Map Center --- */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 1 }}
      >
        <Typography variant="body1" fontFamily="monospace">
          ╠═
        </Typography>
        <Typography variant="subtitle1" sx={{ mx: 1 }}>
          Map Center
        </Typography>
        <Typography variant="body1" fontFamily="monospace">
          ═╣
        </Typography>
      </Box>
      <Box
        mx={1}
        mt={0.5}
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap={1.5}
      >
        {centerDefs.map(({ label, field, placeholder }) => (
          <Box
            key={field}
            width="100%"
            maxWidth="400px"
            display="flex"
            gap={1}
            alignItems="center"
          >
            <Typography variant="body2" fontSize="16px" minWidth="15px">
              {label}:
            </Typography>
            <TextField
              fullWidth
              placeholder={placeholder}
              variant="outlined"
              size="small"
              value={field === "x" ? cordinates[0] : cordinates[1]}
              // onChange={(e) => onCenterChange(field, e.target.value)}
              onChange={(e) => e.target.value}
              sx={{
                "& .MuiInputBase-input": {
                  padding: "4px 6px",
                  fontSize: "0.75rem",
                },
                "& fieldset": { border: "2px solid black" },
              }}
            />
          </Box>
        ))}
      </Box>

      {/* --- Map Zoom --- */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        sx={{ my: 2 }}
      >
        <Typography variant="body1" fontFamily="monospace">
          ╠═
        </Typography>
        <Typography variant="subtitle1" sx={{ mx: 1 }}>
          Map Zoom
        </Typography>
        <Typography variant="body1" fontFamily="monospace">
          ═╣
        </Typography>
      </Box>
      <Box
        mx={1}
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap={1.5}
      >
        <Box
          width="100%"
          maxWidth="400px"
          display="flex"
          gap={1}
          alignItems="center"
        >
          <Typography variant="body2" fontSize="16px" minWidth="45px">
            Zoom:
          </Typography>
          <TextField
            type="number"
            inputProps={{ min: 0, max: 20, step: 0.1 }}
            variant="outlined"
            size="small"
            value={zoom}
            onChange={handleZoomInput}
            sx={{
              "& .MuiInputBase-input": {
                padding: "4px 6px",
                fontSize: "0.75rem",
              },
              "& fieldset": { border: "2px solid black" },
            }}
          />
        </Box>
        <Box width="100%" maxWidth="400px">
          <Slider
            value={zoom}
            min={0}
            max={20}
            step={0.1}
            onChange={handleZoomSlider}
            valueLabelDisplay="auto"
          />
        </Box>
      </Box>

      {/* --- Map Constraints (extent) --- */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        sx={{ my: 2 }}
      >
        <Typography variant="body1" fontFamily="monospace">
          ╠═
        </Typography>
        <Typography variant="subtitle1" sx={{ mx: 1 }}>
          Map Constraints
        </Typography>
        <Typography variant="body1" fontFamily="monospace">
          ═╣
        </Typography>
      </Box>
      <Box
        mx={1}
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap={1.5}
      >
        {constraintFields.map(({ key, label }) => (
          <Box
            key={key}
            width="100%"
            maxWidth="400px"
            display="flex"
            gap={1}
            alignItems="center"
          >
            <Typography variant="body2" fontSize="16px" minWidth="100px">
              {label}:
            </Typography>
            <TextField
              type="number"
              variant="outlined"
              size="small"
              value={constraints[key]}
              onChange={(e) => onConstraintChange(key, e.target.value)}
              sx={{
                flex: 1,
                "& .MuiInputBase-input": {
                  padding: "4px 6px",
                  fontSize: "0.75rem",
                },
                "& fieldset": { border: "2px solid black" },
              }}
            />
          </Box>
        ))}
      </Box>

      {/* --- Map Layers  --- */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        sx={{ my: 2 }}
      >
        <Typography variant="body1" fontFamily="monospace">
          ╠═
        </Typography>
        <Typography variant="subtitle1" sx={{ mx: 1 }}>
          Map Layers
        </Typography>
        <Typography variant="body1" fontFamily="monospace">
          ═╣
        </Typography>
      </Box>
      <Box
        mx={1}
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap={1.5}
      >
        {layers?.map((url, index) => {
          console.log(url);
          return (
            <Box
              key={index}
              width="100%"
              maxWidth="400px"
              display="flex"
              gap={1}
              alignItems="center"
            >
              <Typography variant="body2" fontSize="16px" minWidth="100px">
                <div style={{ wordWrap: "break-word" }}>{url}</div>
              </Typography>
            </Box>
          );
        })}
        <Box
          width="100%"
          maxWidth="400px"
          display="flex"
          gap={1}
          alignItems="center"
        >
          <Typography variant="body2" fontSize="16px" minWidth="100px">
            Add Layer:
          </Typography>
          <TextField
            type="string"
            variant="outlined"
            size="small"
            placeholder="Enter URL to Layer"
            value={layerURL}
            onChange={handleChange}
            sx={{
              flex: 1,
              "& .MuiInputBase-input": {
                padding: "4px 6px",
                fontSize: "0.75rem",
              },
              "& fieldset": { border: "2px solid black" },
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
