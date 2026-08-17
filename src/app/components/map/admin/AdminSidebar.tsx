"use client";

import { useCallback, useState } from "react";
import { Box } from "@mui/material";

import EditPanel from "./EditPanel";
import CategoryCreatePanel from "./CategoryCreatePanel";
import MapSettingsPanel from "./MapSettingsPanel";
import MapSidebar, {
  MapSidebarButton,
  type MapSidebarGraphic,
} from "../sidebar/MapSidebar";
import {
  goToDrawing,
  useFinalizedDrawings,
} from "../sidebar/useMapDrawings";
import { ROOT_CATEGORY_ID } from "../categories/categoryStore";

export default function AdminSidebar() {
  const drawings = useFinalizedDrawings();
  const [activeCategoryId, setActiveCategoryId] = useState(ROOT_CATEGORY_ID);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);

  const startEditing = useCallback((graphic: MapSidebarGraphic) => {
    const id = graphic.attributes?.id;
    if (typeof id === "string" && id.trim()) {
      setEditingId(id);
    }
  }, []);

  return (
    <Box sx={{ height: "100%", overflowY: "auto", p: 2 }}>
      <MapSettingsPanel />

      <MapSidebar
        drawings={drawings}
        onGoTo={goToDrawing}
        onActiveCategoryChange={setActiveCategoryId}
        headerActions={() => (
          <>
            <MapSidebarButton onClick={() => setCreatingCategory(true)}>
              + New Category
            </MapSidebarButton>
            <MapSidebarButton onClick={() => setCreatingItem(true)}>
              + New Item
            </MapSidebarButton>
          </>
        )}
        renderItemActions={(graphic) => (
          <MapSidebarButton onClick={() => startEditing(graphic)}>
            Edit
          </MapSidebarButton>
        )}
      />

      {editingId && (
        <EditPanel
          mode="edit"
          editingId={editingId}
          onClose={() => setEditingId(null)}
        />
      )}

      {creatingItem && (
        <EditPanel
          mode="create"
          initialCategoryId={activeCategoryId}
          onClose={() => setCreatingItem(false)}
        />
      )}

      {creatingCategory && (
        <CategoryCreatePanel
          parentCategoryId={activeCategoryId}
          onClose={() => setCreatingCategory(false)}
        />
      )}
    </Box>
  );
}
