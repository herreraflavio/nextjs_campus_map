// MapControls.tsx
import React, { useState } from "react";
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

interface FieldInfo {
  fieldName: string;
  label: string;
  visible: boolean;
  format?: {
    digitSeparator?: boolean;
    places?: number;
  };
}

export interface FeatureLayerConfig {
  id: string; // ✅ stable id
  url: string;
  index: number;
  outFields: string[];
  popupEnabled: boolean;
  popupTemplate?: {
    title: string;
    content: Array<{
      type: string;
      fieldInfos?: FieldInfo[];
    }>;
  };
}

// types at top of file
type PopupTemplate = NonNullable<FeatureLayerConfig["popupTemplate"]>;
type PopupContentItem = PopupTemplate["content"][number];

const ensureTemplate = (
  tpl?: FeatureLayerConfig["popupTemplate"]
): PopupTemplate => ({
  title: tpl?.title ?? "",
  content: (tpl?.content ?? []) as PopupContentItem[],
});

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

  // layers
  layers: FeatureLayerConfig[];
  setLayers: React.Dispatch<React.SetStateAction<FeatureLayerConfig[]>>;

  // per-layer temporary input for field name (keyed by layer.id)
  fieldNameById: Record<string, string>;
  setFieldNameById: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
}

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
  setLayers,
  fieldNameById,
  setFieldNameById,
}: Props) {
  const handleZoomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!isNaN(val)) onZoomChange(val);
  };

  const handleZoomSlider = (
    _: Event | React.SyntheticEvent,
    val: number | number[]
  ) => {
    const v = Array.isArray(val) ? val[0] : val;
    onZoomChange(v);
  };

  const [layerURL, setLayerURL] = useState<string>("");
  const [layerTitle, setLayerTitle] = useState<string>("");

  function sortByIndex(arr: FeatureLayerConfig[]) {
    return [...arr].sort((a, b) => a.index - b.index);
  }

  function handleLayerIndexChange(layerId: string, next: number) {
    setLayers((prev) => {
      const updated = prev.map((l) =>
        l.id === layerId ? { ...l, index: next } : l
      );
      return sortByIndex(updated);
    });
  }

  function handleAddingField(layerId: string) {
    const name = (fieldNameById[layerId] ?? "").trim();
    if (!name) return;

    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id !== layerId) return layer;

        const baseTemplate = ensureTemplate(layer.popupTemplate);
        const content0: PopupContentItem = baseTemplate.content[0] ?? {
          type: "fields",
          fieldInfos: [],
        };

        const nextFieldInfos: FieldInfo[] = [
          ...(content0.fieldInfos ?? []),
          {
            fieldName: name,
            label: name,
            visible: true,
            format: { digitSeparator: true, places: 0 },
          },
        ];

        const nextContent0: PopupContentItem = {
          ...content0,
          fieldInfos: nextFieldInfos,
        };

        const nextContent: PopupContentItem[] = baseTemplate.content.length
          ? [nextContent0, ...baseTemplate.content.slice(1)]
          : [nextContent0];

        return {
          ...layer,
          popupTemplate: { ...baseTemplate, content: nextContent },
        };
      })
    );

    setFieldNameById((s) => {
      const next = { ...s };
      next[layerId] = "";
      return next;
    });
  }

  function handleRemoveField(layerId: string, removeName: string) {
    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id !== layerId) return layer;

        const baseTemplate = ensureTemplate(layer.popupTemplate);
        const c0: PopupContentItem = baseTemplate.content[0] ?? {
          type: "fields",
          fieldInfos: [],
        };

        const pruned: PopupContentItem = {
          ...c0,
          fieldInfos: (c0.fieldInfos ?? []).filter(
            (f) => f.fieldName !== removeName
          ),
        };

        return {
          ...layer,
          popupTemplate: {
            ...baseTemplate,
            content: [pruned, ...baseTemplate.content.slice(1)],
          },
        };
      })
    );
  }

  function handleRemovingLayer(layerId: string) {
    setLayers((prev) => prev.filter((l) => l.id !== layerId));
    setFieldNameById(({ [layerId]: _, ...rest }) => rest);
  }

  function handleAddingLayer() {
    if (!layerURL.trim()) return;
    const nextIndex =
      (layers.length ? Math.max(...layers.map((l) => l.index)) : -1) + 1;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    setLayers((prev) =>
      sortByIndex([
        ...prev,
        {
          id,
          url: layerURL.trim(),
          index: nextIndex,
          outFields: ["*"],
          popupEnabled: true,
          popupTemplate: {
            title: layerTitle ?? "",
            content: [
              {
                type: "fields",
                fieldInfos: [
                  {
                    fieldName: "hall",
                    label: "Hall Name",
                    visible: true,
                  },
                  {
                    fieldName: "beds",
                    label: "Number of Beds",
                    visible: true,
                    format: {
                      digitSeparator: true,
                      places: 0,
                    },
                  },
                ],
              },
            ],
          },
        },
      ])
    );

    // clear inputs (optional)
    setLayerURL("");
    setLayerTitle("");
  }

  //define your extent fields
  const constraintFields: Array<{ key: keyof Constraints; label: string }> = [
    { key: "xmin", label: "Min X (xmin)" },
    { key: "ymin", label: "Min Y (ymin)" },
    { key: "xmax", label: "Max X (xmax)" },
    { key: "ymax", label: "Max Y (ymax)" },
  ];

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
              onChange={(e) => onCenterChange(field, e.target.value)}
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
        {layers.map((layer, idx) => (
          <Box
            key={layer.id} // ✅ stable key
            width="100%"
            maxWidth="400px"
            display="flex"
            gap={1}
            alignItems="center"
            flexDirection="column"
            borderBottom="solid 4px black"
          >
            <Typography
              variant="body2"
              fontSize="16px"
              minWidth="100px"
              width="100%"
            >
              <div style={{ wordWrap: "break-word", width: "100%" }}>
                {layer.url}
              </div>
            </Typography>

            <Typography
              variant="body2"
              fontSize="16px"
              minWidth="100px"
              width="100%"
            >
              <div style={{ wordWrap: "break-word", width: "100%" }}>
                layer index:&nbsp;
                <input
                  type="number"
                  value={layer.index}
                  onChange={(e) =>
                    handleLayerIndexChange(layer.id, Number(e.target.value))
                  }
                  style={{ width: 80 }}
                />
              </div>
            </Typography>

            <Typography
              variant="body2"
              fontSize="16px"
              minWidth="100px"
              width="100%"
            >
              <div style={{ wordWrap: "break-word", width: "100%" }}>
                <span>
                  popup enabled: {layer.popupEnabled ? <>True</> : <>False</>}
                </span>
              </div>
            </Typography>

            <Typography
              variant="body2"
              fontSize="16px"
              minWidth="100px"
              width="100%"
            >
              <div>Popup Template</div>
              <div style={{ marginLeft: "10px" }}>
                <div>Title: {layer.popupTemplate?.title}</div>
                <div style={{ marginLeft: "10px" }}>
                  {(layer.popupTemplate?.content?.[0]?.fieldInfos ?? []).map(
                    (field) => (
                      <div
                        key={field.fieldName}
                        style={{ display: "flex", gap: 8 }}
                      >
                        <div>{field.fieldName}</div>
                        <button
                          style={{ color: "red" }}
                          onClick={() =>
                            handleRemoveField(layer.id, field.fieldName)
                          }
                        >
                          remove
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </Typography>

            <Typography>
              <TextField
                size="small"
                placeholder="field name"
                value={fieldNameById[layer.id] ?? ""}
                onChange={(e) =>
                  setFieldNameById((s) => ({
                    ...s,
                    [layer.id]: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddingField(layer.id);
                }}
                sx={{
                  mr: 1,
                  "& .MuiInputBase-input": {
                    padding: "4px 6px",
                    fontSize: "0.75rem",
                  },
                  "& fieldset": { border: "2px solid black" },
                }}
              />
              <button
                style={{ color: "green" }}
                onClick={() => handleAddingField(layer.id)}
              >
                add field
              </button>
            </Typography>
            <Typography
              variant="body2"
              fontSize="16px"
              minWidth="100px"
              width="100%"
            >
              <button
                style={{ color: "red" }}
                onClick={() => handleRemovingLayer(layer.id)}
              >
                remove layer
              </button>
            </Typography>
          </Box>
        ))}

        <Box
          width="100%"
          maxWidth="400px"
          display="flex"
          gap={1}
          alignItems="left"
          flexDirection="column"
        >
          <TextField
            type="string"
            variant="outlined"
            size="small"
            placeholder="Enter URL to Layer"
            value={layerURL}
            onChange={(e) => setLayerURL(e.target.value)}
            sx={{
              flex: 1,
              "& .MuiInputBase-input": {
                padding: "4px 6px",
                fontSize: "0.75rem",
              },
              "& fieldset": { border: "2px solid black" },
            }}
          />
          <TextField
            type="string"
            variant="outlined"
            size="small"
            placeholder="Enter title to Layer"
            value={layerTitle}
            onChange={(e) => setLayerTitle(e.target.value)}
            sx={{
              flex: 1,
              "& .MuiInputBase-input": {
                padding: "4px 6px",
                fontSize: "0.75rem",
              },
              "& fieldset": { border: "2px solid black" },
            }}
          />
          <Typography variant="body2" fontSize="16px" minWidth="100px">
            <button onClick={handleAddingLayer}>Add Layer</button>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
