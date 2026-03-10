"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  addEventToStore,
  updateEventInStore,
  settingsRef,
} from "../arcgisRefs";
import { saveMapToServer } from "@/app/helper/saveMap";
import { useMapId } from "@/app/context/MapContext";
import { useSession } from "next-auth/react";
import {
  SearchableLocationInput,
  useLocationSearchGraph,
} from "../../../helper/searchLocation";

export default function AddEvent() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(true)}
        style={{
          color: "black",
          position: "absolute",
          bottom: "-60px",
          right: "calc(100% / 2 + -1px)",
          zIndex: 999,
          padding: "10px 14px",
          fontWeight: 900,
          border: "4px solid black",
          borderRadius: "10%",
          backgroundColor: "orange",
          cursor: "pointer",
        }}
      >
        add events
      </button>

      {open && <EventModal onClose={() => setOpen(false)} />}
    </div>
  );
}

// 1. EXPORT the modal and add the initialEvent prop
export function EventModal({
  onClose,
  initialEvent,
}: {
  onClose: () => void;
  initialEvent?: any;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const mapId = useMapId();
  const { data: session } = useSession();

  const {
    loading: loadingLocations,
    error: locationError,
    searchOptions,
    getNodeById,
    getLabelById,
    resolveLocationId,
  } = useLocationSearchGraph();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialEvent?.poster_url || null,
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiRaw, setApiRaw] = useState<any | null>(
    initialEvent?.original || null,
  );

  // 2. INITIALIZE state with existing event data if present
  const [eventName, setEventName] = useState(initialEvent?.event_name || "");
  const [description, setDescription] = useState(
    initialEvent?.description || "",
  );
  const [dateStr, setDateStr] = useState<string>(initialEvent?.date || "");

  // FIX: Parse initial times into HH:mm format for the <input type="time">
  const initialStart = initialEvent?.startAt
    ? parseOne(initialEvent.startAt) || initialEvent.startAt
    : "";
  const initialEnd = initialEvent?.endAt
    ? parseOne(initialEvent.endAt) || initialEvent.endAt
    : "";

  const [startAt, setStartAt] = useState<string>(initialStart);
  const [endAt, setEndAt] = useState<string>(initialEnd);

  const [search, setSearch] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  // Attempt to pre-fill location search if editing an existing event
  useEffect(() => {
    if (initialEvent && !selectedLocationId) {
      const existingLoc =
        initialEvent.location_at ||
        initialEvent.locationTag ||
        initialEvent.location;
      if (existingLoc) setSearch(existingLoc);
    }
  }, [initialEvent, selectedLocationId]);

  useEffect(() => {
    if (!selectedLocationId) return;
    const label = getLabelById(selectedLocationId);
    if (label) {
      setSearch(label);
    }
  }, [selectedLocationId, getLabelById]);

  function onPickFile(f?: File | null) {
    if (!f) return;
    if (!/^image\/(png|jpe?g)$/i.test(f.type)) return;

    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function analyze() {
    if (!file) return;
    setIsAnalyzing(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(
        "https://uc-merced-campus-event-api-backend.onrender.com/ask",
        { method: "POST", body: fd },
      );

      const data = await res.json();
      setApiRaw(data);

      setEventName(data?.event_name || "");
      setDescription(data?.description || "");

      const d = toDateInputValue(data?.date);
      if (d) setDateStr(d);

      const { start, end } = parseTimeRange(data?.time || "");
      if (start) setStartAt(start);
      if (end) setEndAt(end);

      const rawLocation =
        [data?.location_at, data?.location]
          .find(
            (v): v is string => typeof v === "string" && v.trim().length > 0,
          )
          ?.trim() ?? "";

      if (rawLocation) {
        const resolvedId = resolveLocationId(rawLocation);
        if (resolvedId) {
          setSelectedLocationId(resolvedId);
          setSearch(getLabelById(resolvedId));
        } else {
          setSelectedLocationId("");
          setSearch(rawLocation);
        }
      }
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function save() {
    let finalX = initialEvent?.geometry?.x;
    let finalY = initialEvent?.geometry?.y;
    let locationLabel = search; // fallback

    // If a new route vertex was selected, update coords
    if (selectedLocationId) {
      const selectedNode = getNodeById(selectedLocationId);
      if (selectedNode) {
        finalX = selectedNode.lon;
        finalY = selectedNode.lat;
        locationLabel =
          getLabelById(selectedLocationId) ||
          selectedNode.name ||
          selectedNode.id;
      }
    } else if (!initialEvent) {
      console.warn("Cannot save event: no route vertex selected.");
      return;
    }

    // 3. Keep existing ID if editing, otherwise generate new
    const id = initialEvent?.id || `evt-${Date.now()}`;

    const eventPayload = {
      id,
      event_name: eventName.trim(),
      description: description.trim() || undefined,
      date: dateStr || undefined,
      startAt: startAt || undefined,
      endAt: endAt || undefined,
      poster_url:
        previewUrl || "https://cdn-icons-png.flaticon.com/512/2558/2558944.png",
      location_at: locationLabel,
      location: locationLabel,
      names: apiRaw?.names || initialEvent?.names || undefined,
      original: apiRaw || initialEvent?.original || undefined,
      geometry: {
        x: finalX,
        y: finalY,
        wkid: 4326,
      },
      fromUser: true,
      iconSize: 36,
      iconUrl: "/icons/event-pin.png",
    };

    // 4. Update or Add depending on initialEvent
    if (initialEvent) {
      updateEventInStore(eventPayload);
    } else {
      addEventToStore(eventPayload);
    }

    const email = session?.user?.email ?? "";
    if (email) {
      const s = settingsRef.current;
      const payloadSettings = {
        zoom: s.zoom,
        center: [s.center.x, s.center.y] as [number, number],
        constraints: s.constraints,
        featureLayers: s.featureLayers ?? null,
        mapTile: s.mapTile,
        baseMap: s.baseMap,
        apiSources: s.apiSources,
      };
      saveMapToServer(mapId, email, payloadSettings);
    }

    onClose();
  }

  // Allow save if editing an existing event with valid coordinates, OR if a new location is picked
  const saveDisabled =
    !eventName.trim() || (!selectedLocationId && !initialEvent?.geometry?.x);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        style={{
          width: "min(960px,95vw)",
          maxHeight: "90vh",
          background: "white",
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 10px 40px rgba(0,0,0,.2)",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <strong>
            {initialEvent ? "Edit Campus Event" : "Add Campus Event"}
          </strong>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={btnGhost}>
              Close
            </button>
            <button
              onClick={save}
              disabled={saveDisabled}
              style={btnPrimary(saveDisabled)}
            >
              Save
            </button>
          </div>
        </div>

        <div
          style={{
            padding: 16,
            overflow: "auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          {/* Left Column (Upload) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ fontWeight: 600 }}>Upload flyer (PNG/JPG)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />

            {previewUrl && (
              <div
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  overflow: "hidden",
                  maxHeight: 360,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="preview"
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </div>
            )}

            <button
              onClick={analyze}
              disabled={!file || isAnalyzing}
              style={btnAnalyze(!file || isAnalyzing)}
            >
              {isAnalyzing ? "Analyzing..." : "Upload & Analyze"}
            </button>

            {apiRaw && (
              <>
                <label style={{ fontWeight: 600, marginTop: 6 }}>
                  Raw JSON
                </label>
                <pre style={preJson}>{JSON.stringify(apiRaw, null, 2)}</pre>
              </>
            )}
          </div>

          {/* Right Column (Form) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <TextInput
              label="Event name"
              value={eventName}
              onChange={setEventName}
            />
            <TextArea
              label="Description"
              value={description}
              onChange={setDescription}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <DateInput label="Date" value={dateStr} onChange={setDateStr} />
              <div />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <TimeInput
                label="Start time"
                value={startAt}
                onChange={setStartAt}
              />
              <TimeInput label="End time" value={endAt} onChange={setEndAt} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>
                Location (route vertex)
                {selectedLocationId ? (
                  <span style={{ marginLeft: 8 }}>
                    Selected: <b>{getLabelById(selectedLocationId)}</b>{" "}
                  </span>
                ) : null}
              </label>

              {loadingLocations ? (
                <div style={{ ...inputStyle, color: "#6b7280" }}>
                  Loading searchable walking-network locations…
                </div>
              ) : locationError ? (
                <div
                  style={{
                    ...inputStyle,
                    color: "#b91c1c",
                    background: "#fef2f2",
                  }}
                >
                  Failed to load walking-network locations: {locationError}
                </div>
              ) : (
                <SearchableLocationInput
                  label="Location"
                  query={search}
                  setQuery={setSearch}
                  valueId={selectedLocationId}
                  onChangeId={setSelectedLocationId}
                  options={searchOptions}
                  placeholder="Search walking-network locations…"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* UI helpers remain exactly the same as your original code... */
function TextInput(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontWeight: 600 }}>{p.label}</label>
      <input
        type="text"
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}
function TextArea(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontWeight: 600 }}>{p.label}</label>
      <textarea
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        rows={5}
        style={{ ...inputStyle, resize: "vertical" }}
      />
    </div>
  );
}
function DateInput(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontWeight: 600 }}>{p.label}</label>
      <input
        type="date"
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}
function TimeInput(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontWeight: 600 }}>{p.label}</label>
      <input
        type="time"
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        step={60}
        style={inputStyle}
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  outline: "none",
  fontSize: 14,
  background: "white",
} as const;

const btnAnalyze = (disabled: boolean): React.CSSProperties => ({
  marginTop: 4,
  padding: "10px 12px",
  background: disabled ? "#9ca3af" : "#1a73e8",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 600,
});

const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? "#9ca3af" : "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 700,
});

const btnGhost: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
} as const;

const preJson: React.CSSProperties = {
  background: "#0f172a",
  color: "#e2e8f0",
  padding: 12,
  borderRadius: 8,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: 12,
  maxHeight: 280,
  overflow: "auto",
} as const;

function toDateInputValue(s?: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseTimeRange(raw: string) {
  if (!raw) return {};
  const s = raw.replace(/[–—]/g, "-").toLowerCase();
  const parts = s.split("-").map((p) => p.trim());
  if (parts.length === 1) {
    const t = parseOne(parts[0]);
    return t ? { start: t } : {};
  }
  const left = parseOne(parts[0]);
  const right = parseOne(parts[1], getMer(parts[0]));
  return { start: left, end: right };
}
function getMer(seg: string): "am" | "pm" | undefined {
  const m = seg.toLowerCase().match(/\b(am|pm)\b/);
  return m ? (m[1] as "am" | "pm") : undefined;
}
function parseOne(seg: string, fb?: "am" | "pm") {
  const m = seg.toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = (m[3] as "am" | "pm" | undefined) || fb;
  if (mer === "am") {
    if (h === 12) h = 0;
  } else if (mer === "pm") {
    if (h !== 12) h += 12;
  }
  const hh = String(Math.max(0, Math.min(23, h))).padStart(2, "0");
  const mm = String(Math.max(0, Math.min(59, min))).padStart(2, "0");
  return `${hh}:${mm}`;
}
//current working version bellow
// "use client";

// import React, { useRef, useState } from "react";
// import { addEventToStore, settingsRef } from "../arcgisRefs";
// import { saveMapToServer } from "@/app/helper/saveMap";
// import { useMapId } from "@/app/context/MapContext";
// import { useSession } from "next-auth/react";
// import {
//   SearchableLocationInput,
//   useLocationSearchGraph,
// } from "../../../helper/searchLocation";

// export default function AddEvent() {
//   const [open, setOpen] = useState(false);

//   return (
//     <div style={{ position: "relative" }}>
//       <button
//         onClick={() => setOpen(true)}
//         style={{
//           color: "black",
//           position: "absolute",
//           bottom: "-60px",
//           right: "calc(100% / 2 + -54px)",
//           zIndex: 999,
//           padding: "10px 14px",
//           fontWeight: 900,
//           border: "4px solid black",
//           borderRadius: "10%",
//           backgroundColor: "orange",
//           cursor: "pointer",
//         }}
//       >
//         add events
//       </button>

//       {open && <EventModal onClose={() => setOpen(false)} />}
//     </div>
//   );
// }

// function EventModal({ onClose }: { onClose: () => void }) {
//   const fileInputRef = useRef<HTMLInputElement | null>(null);

//   const mapId = useMapId();
//   const { data: session } = useSession();

//   const {
//     loading: loadingLocations,
//     error: locationError,
//     searchOptions,
//     getNodeById,
//     getLabelById,
//     resolveLocationId,
//   } = useLocationSearchGraph();

//   const [file, setFile] = useState<File | null>(null);
//   const [previewUrl, setPreviewUrl] = useState<string | null>(null);
//   const [isAnalyzing, setIsAnalyzing] = useState(false);
//   const [apiRaw, setApiRaw] = useState<any | null>(null);

//   const [eventName, setEventName] = useState("");
//   const [description, setDescription] = useState("");
//   const [dateStr, setDateStr] = useState<string>("");
//   const [startAt, setStartAt] = useState<string>("");
//   const [endAt, setEndAt] = useState<string>("");

//   const [search, setSearch] = useState("");
//   const [selectedLocationId, setSelectedLocationId] = useState<string>("");

//   React.useEffect(() => {
//     if (!selectedLocationId) return;
//     const label = getLabelById(selectedLocationId);
//     if (label) {
//       setSearch(label);
//     }
//   }, [selectedLocationId, getLabelById]);

//   function onPickFile(f?: File | null) {
//     if (!f) return;
//     if (!/^image\/(png|jpe?g)$/i.test(f.type)) return;

//     setFile(f);
//     setPreviewUrl(URL.createObjectURL(f));
//   }

//   async function analyze() {
//     if (!file) return;

//     setIsAnalyzing(true);

//     try {
//       const fd = new FormData();
//       fd.append("file", file);

//       const res = await fetch(
//         "https://uc-merced-campus-event-api-backend.onrender.com/ask",
//         { method: "POST", body: fd },
//       );

//       const data = await res.json();
//       setApiRaw(data);

//       setEventName(data?.event_name || "");
//       setDescription(data?.description || "");

//       const d = toDateInputValue(data?.date);
//       if (d) setDateStr(d);

//       // const { start, end } = parseTimeRange(data?.time || "");
//       // const { start, end } = data?.time;

//       const { start, end } = parseTimeRange(data?.time || "");
//       console.log(start, end);

//       // if (startGUI) setStartAt(startGUI);
//       // if (endGUI) setEndAt(endGUI);
//       if (start) setStartAt(start);
//       if (end) setEndAt(end);

//       const rawLocation =
//         [data?.location_at, data?.location]
//           .find(
//             (v): v is string => typeof v === "string" && v.trim().length > 0,
//           )
//           ?.trim() ?? "";

//       if (rawLocation) {
//         const resolvedId = resolveLocationId(rawLocation);

//         if (resolvedId) {
//           setSelectedLocationId(resolvedId);
//           setSearch(getLabelById(resolvedId));
//         } else {
//           setSelectedLocationId("");
//           setSearch(rawLocation);
//         }
//       }
//     } finally {
//       setIsAnalyzing(false);
//     }
//   }

//   async function save() {
//     const selectedNode = selectedLocationId
//       ? getNodeById(selectedLocationId)
//       : null;

//     if (!selectedNode) {
//       console.warn("Cannot save event: no route vertex selected.");
//       return;
//     }

//     const locationLabel =
//       getLabelById(selectedLocationId) || selectedNode.name || selectedNode.id;
//     console.log(locationLabel);
//     const id = `evt-${Date.now()}`;
//     console.log(startAt, endAt);
//     addEventToStore({
//       id,
//       event_name: eventName.trim(),
//       description: description.trim() || undefined,
//       date: dateStr || undefined,
//       startAt: startAt || undefined,
//       endAt: endAt || undefined,
//       poster_url: "https://cdn-icons-png.flaticon.com/512/2558/2558944.png",
//       // fullLocationTag: selectedLocationId,
//       location_at: locationLabel,
//       location: locationLabel,
//       names: apiRaw?.names || undefined,
//       original: apiRaw || undefined,
//       geometry: {
//         x: selectedNode.lon,
//         y: selectedNode.lat,
//         wkid: 4326,
//       },
//       fromUser: true,
//       iconSize: 36,
//       iconUrl: "/icons/event-pin.png",
//     });

//     const email = session?.user?.email ?? "";
//     if (!email) {
//       console.warn("Skipping persist: no user email available.");
//     } else {
//       const s = settingsRef.current;
//       const payloadSettings = {
//         zoom: s.zoom,
//         center: [s.center.x, s.center.y] as [number, number],
//         constraints: s.constraints,
//         featureLayers: s.featureLayers ?? null,
//         mapTile: s.mapTile,
//         baseMap: s.baseMap,
//         apiSources: s.apiSources,
//       };
//       saveMapToServer(mapId, email, payloadSettings);
//     }

//     onClose();
//   }

//   const saveDisabled = !eventName.trim() || !selectedLocationId;

//   return (
//     <div
//       role="dialog"
//       aria-modal="true"
//       style={{
//         position: "fixed",
//         inset: 0,
//         background: "rgba(0,0,0,0.5)",
//         zIndex: 999999,
//         display: "flex",
//         alignItems: "center",
//         justifyContent: "center",
//         padding: 16,
//       }}
//       onKeyDown={(e) => e.key === "Escape" && onClose()}
//     >
//       <div
//         style={{
//           width: "min(960px,95vw)",
//           maxHeight: "90vh",
//           background: "white",
//           borderRadius: 12,
//           overflow: "hidden",
//           display: "flex",
//           flexDirection: "column",
//           boxShadow: "0 10px 40px rgba(0,0,0,.2)",
//         }}
//       >
//         {/* Header */}
//         <div
//           style={{
//             padding: "14px 18px",
//             borderBottom: "1px solid #eee",
//             display: "flex",
//             justifyContent: "space-between",
//           }}
//         >
//           <strong>Add Campus Event</strong>
//           <div style={{ display: "flex", gap: 8 }}>
//             <button onClick={onClose} style={btnGhost}>
//               Close
//             </button>
//             <button
//               onClick={save}
//               disabled={saveDisabled}
//               style={btnPrimary(saveDisabled)}
//             >
//               Save
//             </button>
//           </div>
//         </div>

//         {/* Body */}
//         <div
//           style={{
//             padding: 16,
//             overflow: "auto",
//             display: "grid",
//             gridTemplateColumns: "1fr 1fr",
//             gap: 16,
//           }}
//         >
//           {/* Left */}
//           <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
//             <label style={{ fontWeight: 600 }}>Upload flyer (PNG/JPG)</label>
//             <input
//               ref={fileInputRef}
//               type="file"
//               accept="image/png,image/jpeg"
//               onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
//             />

//             {previewUrl && (
//               <div
//                 style={{
//                   border: "1px solid #ddd",
//                   borderRadius: 8,
//                   overflow: "hidden",
//                   maxHeight: 360,
//                 }}
//               >
//                 {/* eslint-disable-next-line @next/next/no-img-element */}
//                 <img
//                   src={previewUrl}
//                   alt="preview"
//                   style={{ width: "100%", height: "auto", display: "block" }}
//                 />
//               </div>
//             )}

//             <button
//               onClick={analyze}
//               disabled={!file || isAnalyzing}
//               style={btnAnalyze(!file || isAnalyzing)}
//             >
//               {isAnalyzing ? "Analyzing..." : "Upload & Analyze"}
//             </button>

//             {apiRaw && (
//               <>
//                 <label style={{ fontWeight: 600, marginTop: 6 }}>
//                   Raw JSON
//                 </label>
//                 <pre style={preJson}>{JSON.stringify(apiRaw, null, 2)}</pre>
//               </>
//             )}
//           </div>

//           {/* Right */}
//           <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
//             <TextInput
//               label="Event name"
//               value={eventName}
//               onChange={setEventName}
//             />

//             <TextArea
//               label="Description"
//               value={description}
//               onChange={setDescription}
//             />

//             <div
//               style={{
//                 display: "grid",
//                 gridTemplateColumns: "1fr 1fr",
//                 gap: 10,
//               }}
//             >
//               <DateInput label="Date" value={dateStr} onChange={setDateStr} />
//               <div />
//             </div>

//             <div
//               style={{
//                 display: "grid",
//                 gridTemplateColumns: "1fr 1fr",
//                 gap: 10,
//               }}
//             >
//               <TimeInput
//                 label="Start time"
//                 value={startAt}
//                 onChange={setStartAt}
//               />
//               <TimeInput label="End time" value={endAt} onChange={setEndAt} />
//             </div>

//             {/* Shared walking-graph location picker */}
//             <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//               <label style={{ fontWeight: 600 }}>
//                 Location (route vertex)
//                 {selectedLocationId ? (
//                   <span style={{ marginLeft: 8 }}>
//                     Selected: <b>{getLabelById(selectedLocationId)}</b>{" "}
//                     <span style={{ color: "#6b7280" }}>
//                       ({selectedLocationId})
//                     </span>
//                   </span>
//                 ) : null}
//               </label>

//               {loadingLocations ? (
//                 <div style={{ ...inputStyle, color: "#6b7280" }}>
//                   Loading searchable walking-network locations…
//                 </div>
//               ) : locationError ? (
//                 <div
//                   style={{
//                     ...inputStyle,
//                     color: "#b91c1c",
//                     background: "#fef2f2",
//                   }}
//                 >
//                   Failed to load walking-network locations: {locationError}
//                 </div>
//               ) : (
//                 <SearchableLocationInput
//                   label="Location"
//                   query={search}
//                   setQuery={setSearch}
//                   valueId={selectedLocationId}
//                   onChangeId={setSelectedLocationId}
//                   options={searchOptions}
//                   placeholder="Search walking-network locations…"
//                 />
//               )}

//               <div style={{ fontSize: 12, color: "#6b7280" }}>
//                 Pick a location from the same vertex graph used by turn-by-turn
//                 routing so newly added events snap to real route vertices.
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* UI helpers */
// function TextInput(p: {
//   label: string;
//   value: string;
//   onChange: (v: string) => void;
// }) {
//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//       <label style={{ fontWeight: 600 }}>{p.label}</label>
//       <input
//         type="text"
//         value={p.value}
//         onChange={(e) => p.onChange(e.target.value)}
//         style={inputStyle}
//       />
//     </div>
//   );
// }

// function TextArea(p: {
//   label: string;
//   value: string;
//   onChange: (v: string) => void;
// }) {
//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//       <label style={{ fontWeight: 600 }}>{p.label}</label>
//       <textarea
//         value={p.value}
//         onChange={(e) => p.onChange(e.target.value)}
//         rows={5}
//         style={{ ...inputStyle, resize: "vertical" }}
//       />
//     </div>
//   );
// }

// function DateInput(p: {
//   label: string;
//   value: string;
//   onChange: (v: string) => void;
// }) {
//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//       <label style={{ fontWeight: 600 }}>{p.label}</label>
//       <input
//         type="date"
//         value={p.value}
//         onChange={(e) => p.onChange(e.target.value)}
//         style={inputStyle}
//       />
//     </div>
//   );
// }

// function TimeInput(p: {
//   label: string;
//   value: string;
//   onChange: (v: string) => void;
// }) {
//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//       <label style={{ fontWeight: 600 }}>{p.label}</label>
//       <input
//         type="time"
//         value={p.value}
//         onChange={(e) => p.onChange(e.target.value)}
//         step={60}
//         style={inputStyle}
//       />
//     </div>
//   );
// }

// /* Styling */
// const inputStyle: React.CSSProperties = {
//   padding: "10px 12px",
//   borderRadius: 8,
//   border: "1px solid #e5e7eb",
//   outline: "none",
//   fontSize: 14,
//   background: "white",
// };

// const btnAnalyze = (disabled: boolean): React.CSSProperties => ({
//   marginTop: 4,
//   padding: "10px 12px",
//   background: disabled ? "#9ca3af" : "#1a73e8",
//   color: "white",
//   border: "none",
//   borderRadius: 8,
//   cursor: disabled ? "not-allowed" : "pointer",
//   fontWeight: 600,
// });

// const btnPrimary = (disabled: boolean): React.CSSProperties => ({
//   background: disabled ? "#9ca3af" : "#16a34a",
//   color: "white",
//   border: "none",
//   borderRadius: 8,
//   padding: "8px 12px",
//   cursor: disabled ? "not-allowed" : "pointer",
//   fontWeight: 700,
// });

// const btnGhost: React.CSSProperties = {
//   background: "transparent",
//   border: "1px solid #ddd",
//   borderRadius: 8,
//   padding: "8px 12px",
//   cursor: "pointer",
// };

// const preJson: React.CSSProperties = {
//   background: "#0f172a",
//   color: "#e2e8f0",
//   padding: 12,
//   borderRadius: 8,
//   whiteSpace: "pre-wrap",
//   wordBreak: "break-word",
//   fontSize: 12,
//   maxHeight: 280,
//   overflow: "auto",
// };

// /* Parsing helpers */
// function toDateInputValue(s?: string): string | null {
//   if (!s) return null;

//   const d = new Date(s);
//   if (Number.isNaN(d.getTime())) return null;

//   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
//     2,
//     "0",
//   )}-${String(d.getDate()).padStart(2, "0")}`;
// }

// function parseTimeRange(raw: string) {
//   if (!raw) return {};

//   const s = raw.replace(/[–—]/g, "-").toLowerCase();
//   const parts = s.split("-").map((p) => p.trim());

//   if (parts.length === 1) {
//     const t = parseOne(parts[0]);
//     return t ? { start: t } : {};
//   }

//   const left = parseOne(parts[0]);
//   const right = parseOne(parts[1], getMer(parts[0]));
//   return { start: left, end: right };
// }

// function getMer(seg: string): "am" | "pm" | undefined {
//   const m = seg.toLowerCase().match(/\b(am|pm)\b/);
//   return m ? (m[1] as "am" | "pm") : undefined;
// }

// function parseOne(seg: string, fb?: "am" | "pm") {
//   const m = seg.toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
//   if (!m) return;

//   let h = parseInt(m[1], 10);
//   const min = m[2] ? parseInt(m[2], 10) : 0;
//   const mer = (m[3] as "am" | "pm" | undefined) || fb;

//   if (mer === "am") {
//     if (h === 12) h = 0;
//   } else if (mer === "pm") {
//     if (h !== 12) h += 12;
//   }

//   const hh = String(Math.max(0, Math.min(23, h))).padStart(2, "0");
//   const mm = String(Math.max(0, Math.min(59, min))).padStart(2, "0");
//   return `${hh}:${mm}`;
// }

// "use client";

// import React, { useMemo, useRef, useState } from "react";
// import { addEventToStore, placesRegistry, settingsRef } from "../arcgisRefs";
// import { saveMapToServer } from "@/app/helper/saveMap";
// import { useMapId } from "@/app/context/MapContext";
// import { useSession } from "next-auth/react";
// import { lookupCoordinatesByLocation } from "./locationIndex";

// export default function AddEvent() {
//   const [open, setOpen] = useState(false);
//   return (
//     <div style={{ position: "relative" }}>
//       <button
//         onClick={() => setOpen(true)}
//         style={{
//           color: "black",
//           position: "absolute",
//           bottom: "-60px",
//           right: "calc(100% / 2 + -54px)",
//           zIndex: 999,
//           padding: "10px 14px",
//           fontWeight: 900,
//           border: "4px solid black",
//           borderRadius: "10%",
//           backgroundColor: "orange",
//           cursor: "pointer",
//         }}
//       >
//         add events
//       </button>
//       {open && <EventModal onClose={() => setOpen(false)} />}
//     </div>
//   );
// }

// function EventModal({ onClose }: { onClose: () => void }) {
//   const fileInputRef = useRef<HTMLInputElement | null>(null);

//   const mapId = useMapId();
//   const { data: session } = useSession();

//   const [file, setFile] = useState<File | null>(null);
//   const [previewUrl, setPreviewUrl] = useState<string | null>(null);
//   const [isAnalyzing, setIsAnalyzing] = useState(false);
//   const [apiRaw, setApiRaw] = useState<any | null>(null);

//   const [eventName, setEventName] = useState("");
//   const [description, setDescription] = useState("");
//   const [dateStr, setDateStr] = useState<string>("");
//   const [startAt, setStartAt] = useState<string>("");
//   const [endAt, setEndAt] = useState<string>("");

//   const [search, setSearch] = useState("");
//   const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>(
//     undefined
//   );

//   const filteredPlaces = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     if (!q) return placesRegistry.slice(0, 20);
//     return placesRegistry.filter(
//       (p) =>
//         p.label.toLowerCase().includes(q) ||
//         p.placeId.toLowerCase().includes(q) ||
//         (p.aliases || []).some((a) => a.toLowerCase().includes(q))
//     );
//   }, [search]);

//   function onPickFile(f?: File | null) {
//     if (!f) return;
//     if (!/^image\/(png|jpe?g)$/i.test(f.type)) return;
//     setFile(f);
//     setPreviewUrl(URL.createObjectURL(f));
//   }

//   async function analyze() {
//     if (!file) return;
//     setIsAnalyzing(true);
//     try {
//       const fd = new FormData();
//       fd.append("file", file);
//       const res = await fetch(
//         "https://uc-merced-campus-event-api-backend.onrender.com/ask",
//         // "http://127.0.0.1:8050/ask",
//         { method: "POST", body: fd }
//       );
//       const data = await res.json();
//       setApiRaw(data);

//       setEventName(data?.event_name || "");
//       setDescription(data?.description || "");
//       const d = toDateInputValue(data?.date);
//       if (d) setDateStr(d);
//       const { start, end } = parseTimeRange(data?.time || "");
//       if (start) setStartAt(start);
//       if (end) setEndAt(end);

//       if (typeof data?.location === "string" && data.location.trim()) {
//         console.log("================found=================");
//         setSelectedPlaceId(data.location);
//       } else {
//         console.log("===============couldnt=found==================");
//         const guess = guessPlaceId(data.location);
//         if (guess) setSelectedPlaceId(guess);
//         else setSearch(data.location);
//       }
//     } finally {
//       setIsAnalyzing(false);
//     }
//   }

//   async function save() {
//     const place = placesRegistry.find((p) => p.placeId === selectedPlaceId);
//     const coords = await lookupCoordinatesByLocation(selectedPlaceId);

//     // 1. Initialize with a default number (so they aren't 'undefined')
//     let lat = 0;
//     let lon = 0;

//     if (coords) {
//       // 2. Use '?? 0' just in case coords.x is technically undefined in the type def
//       lon = coords.x ?? 0;
//       lat = coords.y ?? 0;
//     }
//     console.log(coords);
//     console.log(lon, lat);
//     const id = `evt-${Date.now()}`;

//     // 1) Add to in-memory store so the map renders immediately
//     addEventToStore({
//       id,
//       event_name: eventName.trim(),
//       description: description.trim() || undefined,
//       date: dateStr || undefined,
//       startAt: startAt || undefined,
//       endAt: endAt || undefined,
//       fullLocationTag: place?.placeId || apiRaw?.location_at || undefined,
//       location_at: apiRaw?.location_at || undefined,
//       location: apiRaw?.location || undefined,
//       names: apiRaw?.names || undefined,
//       original: apiRaw || undefined,
//       geometry: coords
//         ? {
//             // x: place.geometry.x,
//             // y: place.geometry.y,
//             x: lon,
//             y: lat,
//             wkid: 4326,
//           }
//         : { x: -120.422045, y: 37.368169, wkid: 4326 },
//       fromUser: true,
//       iconSize: 36,
//       iconUrl: "/icons/event-pin.png",
//     });

//     // 2) Persist immediately (don’t debounce — the modal unmounts)
//     const email = session?.user?.email ?? "";
//     if (!email) {
//       console.warn("Skipping persist: no user email available.");
//     } else {
//       const s = settingsRef.current;
//       const payloadSettings = {
//         zoom: s.zoom,
//         center: [s.center.x, s.center.y] as [number, number],
//         constraints: s.constraints,
//         featureLayers: s.featureLayers ?? null,
//         mapTile: s.mapTile,
//         baseMap: s.baseMap,
//         apiSources: s.apiSources,
//       };
//       saveMapToServer(mapId, email, payloadSettings);
//     }

//     // 3) Close the modal
//     onClose();
//   }

//   return (
//     <div
//       role="dialog"
//       aria-modal="true"
//       style={{
//         position: "fixed",
//         inset: 0,
//         background: "rgba(0,0,0,0.5)",
//         zIndex: 999999,
//         display: "flex",
//         alignItems: "center",
//         justifyContent: "center",
//         padding: 16,
//       }}
//       onKeyDown={(e) => e.key === "Escape" && onClose()}
//     >
//       <div
//         style={{
//           width: "min(960px,95vw)",
//           maxHeight: "90vh",
//           background: "white",
//           borderRadius: 12,
//           overflow: "hidden",
//           display: "flex",
//           flexDirection: "column",
//           boxShadow: "0 10px 40px rgba(0,0,0,.2)",
//         }}
//       >
//         {/* Header */}
//         <div
//           style={{
//             padding: "14px 18px",
//             borderBottom: "1px solid #eee",
//             display: "flex",
//             justifyContent: "space-between",
//           }}
//         >
//           <strong>Add Campus Event</strong>
//           <div style={{ display: "flex", gap: 8 }}>
//             <button onClick={onClose} style={btnGhost}>
//               Close
//             </button>
//             <button
//               onClick={save}
//               disabled={!eventName.trim()}
//               style={btnPrimary(!eventName.trim())}
//             >
//               Save
//             </button>
//           </div>
//         </div>

//         {/* Body */}
//         <div
//           style={{
//             padding: 16,
//             overflow: "auto",
//             display: "grid",
//             gridTemplateColumns: "1fr 1fr",
//             gap: 16,
//           }}
//         >
//           {/* Left */}
//           <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
//             <label style={{ fontWeight: 600 }}>Upload flyer (PNG/JPG)</label>
//             <input
//               ref={fileInputRef}
//               type="file"
//               accept="image/png,image/jpeg"
//               onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
//             />
//             {previewUrl && (
//               <div
//                 style={{
//                   border: "1px solid #ddd",
//                   borderRadius: 8,
//                   overflow: "hidden",
//                   maxHeight: 360,
//                 }}
//               >
//                 {/* eslint-disable-next-line @next/next/no-img-element */}
//                 <img
//                   src={previewUrl}
//                   alt="preview"
//                   style={{ width: "100%", height: "auto", display: "block" }}
//                 />
//               </div>
//             )}
//             <button
//               onClick={analyze}
//               disabled={!file || isAnalyzing}
//               style={btnAnalyze(!file || isAnalyzing)}
//             >
//               {isAnalyzing ? "Analyzing..." : "Upload & Analyze"}
//             </button>

//             {apiRaw && (
//               <>
//                 <label style={{ fontWeight: 600, marginTop: 6 }}>
//                   Raw JSON
//                 </label>
//                 <pre style={preJson}>{JSON.stringify(apiRaw, null, 2)}</pre>
//               </>
//             )}
//           </div>

//           {/* Right */}
//           <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
//             <TextInput
//               label="Event name"
//               value={eventName}
//               onChange={setEventName}
//             />
//             <TextArea
//               label="Description"
//               value={description}
//               onChange={setDescription}
//             />

//             <div
//               style={{
//                 display: "grid",
//                 gridTemplateColumns: "1fr 1fr",
//                 gap: 10,
//               }}
//             >
//               <DateInput label="Date" value={dateStr} onChange={setDateStr} />
//               <div />
//             </div>

//             <div
//               style={{
//                 display: "grid",
//                 gridTemplateColumns: "1fr 1fr",
//                 gap: 10,
//               }}
//             >
//               <TimeInput
//                 label="Start time"
//                 value={startAt}
//                 onChange={setStartAt}
//               />
//               <TimeInput label="End time" value={endAt} onChange={setEndAt} />
//             </div>

//             {/* Place picker */}
//             <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//               <label style={{ fontWeight: 600 }}>
//                 Location (place)
//                 {selectedPlaceId ? (
//                   <span style={{ marginLeft: 8 }}>
//                     Selected: <b>{selectedPlaceId}</b>
//                   </span>
//                 ) : null}
//               </label>
//               <input
//                 type="text"
//                 placeholder="Search places…"
//                 value={search}
//                 onChange={(e) => setSearch(e.target.value)}
//                 style={inputStyle}
//               />
//               <div style={tagListBox}>
//                 {filteredPlaces.length ? (
//                   filteredPlaces.map((p) => (
//                     <button
//                       key={p.placeId}
//                       onClick={() => setSelectedPlaceId(p.placeId)}
//                       style={{
//                         textAlign: "left",
//                         background:
//                           p.placeId === selectedPlaceId ? "#dbeafe" : "white",
//                         border: "1px solid #e5e7eb",
//                         borderRadius: 6,
//                         padding: "6px 8px",
//                         cursor: "pointer",
//                       }}
//                     >
//                       {p.label}{" "}
//                       <span style={{ color: "#6b7280" }}>({p.placeId})</span>
//                     </button>
//                   ))
//                 ) : (
//                   <div style={{ color: "#6b7280", padding: "2px 4px" }}>
//                     No matches
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* UI helpers */
// function TextInput(p: {
//   label: string;
//   value: string;
//   onChange: (v: string) => void;
// }) {
//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//       <label style={{ fontWeight: 600 }}>{p.label}</label>
//       <input
//         type="text"
//         value={p.value}
//         onChange={(e) => p.onChange(e.target.value)}
//         style={inputStyle}
//       />
//     </div>
//   );
// }
// function TextArea(p: {
//   label: string;
//   value: string;
//   onChange: (v: string) => void;
// }) {
//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//       <label style={{ fontWeight: 600 }}>{p.label}</label>
//       <textarea
//         value={p.value}
//         onChange={(e) => p.onChange(e.target.value)}
//         rows={5}
//         style={{ ...inputStyle, resize: "vertical" }}
//       />
//     </div>
//   );
// }
// function DateInput(p: {
//   label: string;
//   value: string;
//   onChange: (v: string) => void;
// }) {
//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//       <label style={{ fontWeight: 600 }}>{p.label}</label>
//       <input
//         type="date"
//         value={p.value}
//         onChange={(e) => p.onChange(e.target.value)}
//         style={inputStyle}
//       />
//     </div>
//   );
// }
// function TimeInput(p: {
//   label: string;
//   value: string;
//   onChange: (v: string) => void;
// }) {
//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//       <label style={{ fontWeight: 600 }}>{p.label}</label>
//       <input
//         type="time"
//         value={p.value}
//         onChange={(e) => p.onChange(e.target.value)}
//         step={60}
//         style={inputStyle}
//       />
//     </div>
//   );
// }

// /* Styling */
// const inputStyle: React.CSSProperties = {
//   padding: "10px 12px",
//   borderRadius: 8,
//   border: "1px solid #e5e7eb",
//   outline: "none",
//   fontSize: 14,
//   background: "white",
// };
// const btnAnalyze = (disabled: boolean): React.CSSProperties => ({
//   marginTop: 4,
//   padding: "10px 12px",
//   background: disabled ? "#9ca3af" : "#1a73e8",
//   color: "white",
//   border: "none",
//   borderRadius: 8,
//   cursor: disabled ? "not-allowed" : "pointer",
//   fontWeight: 600,
// });
// const btnPrimary = (disabled: boolean): React.CSSProperties => ({
//   background: disabled ? "#9ca3af" : "#16a34a",
//   color: "white",
//   border: "none",
//   borderRadius: 8,
//   padding: "8px 12px",
//   cursor: disabled ? "not-allowed" : "pointer",
//   fontWeight: 700,
// });
// const btnGhost: React.CSSProperties = {
//   background: "transparent",
//   border: "1px solid #ddd",
//   borderRadius: 8,
//   padding: "8px 12px",
//   cursor: "pointer",
// };
// const preJson: React.CSSProperties = {
//   background: "#0f172a",
//   color: "#e2e8f0",
//   padding: 12,
//   borderRadius: 8,
//   whiteSpace: "pre-wrap",
//   wordBreak: "break-word",
//   fontSize: 12,
//   maxHeight: 280,
//   overflow: "auto",
// };
// const tagListBox: React.CSSProperties = {
//   border: "1px solid #e5e7eb",
//   borderRadius: 8,
//   maxHeight: 160,
//   overflow: "auto",
//   padding: 6,
//   display: "grid",
//   gap: 6,
//   background: "#fafafa",
// };

// /* Parsing helpers */
// function toDateInputValue(s?: string): string | null {
//   if (!s) return null;
//   const d = new Date(s);
//   if (Number.isNaN(d.getTime())) return null;
//   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
//     2,
//     "0"
//   )}-${String(d.getDate()).padStart(2, "0")}`;
// }
// function parseTimeRange(raw: string) {
//   if (!raw) return {};
//   const s = raw.replace(/[–—]/g, "-").toLowerCase();
//   const parts = s.split("-").map((p) => p.trim());
//   if (parts.length === 1) {
//     const t = parseOne(parts[0]);
//     return t ? { start: t } : {};
//   }
//   const left = parseOne(parts[0]);
//   const right = parseOne(parts[1], getMer(parts[0]));
//   return { start: left, end: right };
// }
// function getMer(seg: string): "am" | "pm" | undefined {
//   const m = seg.toLowerCase().match(/\b(am|pm)\b/);
//   return m ? (m[1] as any) : undefined;
// }
// function parseOne(seg: string, fb?: "am" | "pm") {
//   const m = seg.toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
//   if (!m) return;
//   let h = parseInt(m[1], 10);
//   const min = m[2] ? parseInt(m[2], 10) : 0;
//   const mer = (m[3] as any) || fb;
//   if (mer === "am") {
//     if (h === 12) h = 0;
//   } else if (mer === "pm") {
//     if (h !== 12) h += 12;
//   }
//   const hh = String(Math.max(0, Math.min(23, h))).padStart(2, "0");
//   const mm = String(Math.max(0, Math.min(59, min))).padStart(2, "0");
//   return `${hh}:${mm}`;
// }

// /* Quick place guess from free text */
// function guessPlaceId(freeText: string): string | undefined {
//   const n = freeText.trim().toLowerCase();
//   const exact = placesRegistry.find(
//     (p) =>
//       p.label.toLowerCase() === n ||
//       p.placeId.toLowerCase() === n ||
//       (p.aliases || []).some((a) => a.toLowerCase() === n)
//   );
//   if (exact) return exact.placeId;
//   const incl = placesRegistry.find(
//     (p) =>
//       p.label.toLowerCase().includes(n) || n.includes(p.label.toLowerCase())
//   );
//   return incl?.placeId;
// }
