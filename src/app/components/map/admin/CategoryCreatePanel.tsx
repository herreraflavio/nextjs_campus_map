"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useMapId } from "@/app/context/MapContext";
import {
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import {
  addCategory,
  createCategoryId,
  nextCategoryOrder,
  normalizePersistedParentId,
} from "../categories/categoryStore";
import { settingsRef } from "../arcgisRefs";
import { saveMapToServer } from "@/app/helper/saveMap";
import type { FeatureLayerConfig } from "@/app/types/myTypes";

type CategoryCreatePanelProps = {
  parentCategoryId: string;
  onClose: () => void;
};

const DEFAULT_APISOURCES: string[] = [];

function getUploadUrlFromResponse(payload: any): string | null {
  const candidates = [
    payload?.url,
    payload?.imageUrl,
    payload?.location,
    payload?.fileUrl,
    payload?.data?.url,
    payload?.data?.imageUrl,
    payload?.data?.location,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function coerceStringArray(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function CategoryCreatePanel({
  parentCategoryId,
  onClose,
}: CategoryCreatePanelProps) {
  const [name, setName] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: session } = useSession();
  const userEmail = session?.user?.email;
  const mapId = useMapId();

  const uploadIcon = async (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Only image uploads are supported.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed (${response.status})`);
      }

      const payload = await response.json();
      const url = getUploadUrlFromResponse(payload);
      if (!url) {
        throw new Error(
          "Upload succeeded but no image URL was returned by /api/upload.",
        );
      }

      setIconUrl(url);
    } catch (uploadError: any) {
      console.error(uploadError);
      setError(uploadError?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const saveCategory = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (!userEmail) {
      setError("You must be signed in to save categories.");
      return;
    }

    const parentId = normalizePersistedParentId(parentCategoryId);
    addCategory({
      id: createCategoryId(),
      name: trimmedName,
      parentId,
      iconUrl: iconUrl.trim() || null,
      order: nextCategoryOrder(parentId),
    });

    const s = settingsRef.current as any;
    const cleanedSources = coerceStringArray(s.apiSources);

    saveMapToServer(mapId, userEmail, {
      zoom: s.zoom,
      center: [s.center.x, s.center.y] as [number, number],
      constraints: s.constraints,
      featureLayers: (s.featureLayers ?? []) as FeatureLayerConfig[],
      mapTile: s.mapTile,
      baseMap: s.baseMap,
      apiSources:
        cleanedSources.length > 0 ? cleanedSources : DEFAULT_APISOURCES,
    });

    onClose();
  };

  return (
    <Box
      sx={{
        position: "absolute",
        top: 90,
        right: 25,
        zIndex: 999,
        bgcolor: "background.paper",
        p: 2,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        borderRadius: 1,
        width: 340,
      }}
    >
      <Typography variant="h6" sx={{ mb: 1 }}>
        New Category
      </Typography>

      <TextField
        label="Name"
        fullWidth
        value={name}
        onChange={(event) => setName(event.target.value)}
        size="small"
        margin="dense"
      />

      {iconUrl && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
          <img
            src={iconUrl}
            alt=""
            style={{
              width: 44,
              height: 44,
              objectFit: "cover",
              borderRadius: 4,
              border: "1px solid #ddd",
            }}
          />
          <Button size="small" onClick={() => setIconUrl("")}>
            Clear
          </Button>
        </Box>
      )}

      <Box sx={{ mt: 1 }}>
        <Button
          component="label"
          variant="outlined"
          size="small"
          startIcon={
            uploading ? <CircularProgress size={14} /> : <UploadFileIcon />
          }
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Upload Icon"}
          <input
            hidden
            type="file"
            accept="image/*"
            onChange={(event) => {
              void uploadIcon(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}

      <Box sx={{ textAlign: "right", mt: 2 }}>
        <Button onClick={onClose} sx={{ mr: 1 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={saveCategory}
          disabled={!name.trim() || uploading}
        >
          Save
        </Button>
      </Box>
    </Box>
  );
}
