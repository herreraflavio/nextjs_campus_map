"use client";

import React, { useState, useEffect } from "react";
import { EventModal } from "./addEvent";
import { generateExport, deleteEventFromStore } from "../arcgisRefs";

export default function EventsDashboardManager() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          color: "#ffffff",
          position: "absolute",
          bottom: "-60px",
          right: "calc(50% - 154px)",
          zIndex: 999,
          padding: "10px 14px",
          fontWeight: 900,
          border: "4px solid black",
          borderRadius: "10%",
          backgroundColor: "#005bff",
          cursor: "pointer",
        }}
      >
        Manage Events
      </button>

      {isOpen && <DashboardOverlay onClose={() => setIsOpen(false)} />}
    </>
  );
}

function DashboardOverlay({ onClose }: { onClose: () => void }) {
  const [events, setEvents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingEvent, setEditingEvent] = useState<any | null>(null);

  // Load all events currently on the map/store
  const loadEvents = () => {
    const { events: mapEvents } = generateExport();
    // Re-map the exported format back to a flat structure for the UI
    const flatEvents = mapEvents.map((e) => ({
      ...e.attributes,
      geometry: e.geometry,
    }));
    setEvents(flatEvents);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to remove this event from the map?")) {
      deleteEventFromStore(id);
      loadEvents(); // refresh local list
    }
  };

  const filteredEvents = events.filter(
    (ev) =>
      ev.event_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.location_at?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.location?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(255, 255, 255, 0.95)", // High opacity white backdrop
        zIndex: 999998, // Just below the EventModal
        display: "flex",
        flexDirection: "column",
        padding: "40px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "28px" }}>Event Dashboard</h1>
        <button
          onClick={onClose}
          style={{
            padding: "8px 16px",
            fontSize: "16px",
            cursor: "pointer",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        >
          Close Dashboard
        </button>
      </div>

      <input
        type="text"
        placeholder="Search events by name or location..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          padding: "12px",
          fontSize: "16px",
          width: "100%",
          maxWidth: "400px",
          marginBottom: "20px",
          borderRadius: "6px",
          border: "1px solid #ccc",
        }}
      />

      {/* Grid Container */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          paddingBottom: "20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "24px",
          }}
        >
          {filteredEvents.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                padding: "40px",
                textAlign: "center",
                color: "#6b7280",
                border: "1px dashed #ccc",
                borderRadius: "8px",
              }}
            >
              No events found.
            </div>
          ) : (
            filteredEvents.map((ev) => (
              <div
                key={ev.id}
                style={{
                  border: "1px solid #eaeaea",
                  borderRadius: "10px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  background: "white",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                }}
              >
                {/* Image Header */}
                <div
                  style={{
                    width: "100%",
                    height: "160px",
                    backgroundColor: "#f3f4f6",
                    borderBottom: "1px solid #eaeaea",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      ev.poster_url ||
                      "https://cdn-icons-png.flaticon.com/512/2558/2558944.png"
                    }
                    alt={ev.event_name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>

                {/* Card Body */}
                <div
                  style={{
                    padding: "16px",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "18px",
                      color: "#111827",
                      lineHeight: "1.3",
                    }}
                  >
                    {ev.event_name}
                  </h3>

                  <div
                    style={{
                      fontSize: "14px",
                      color: "#4b5563",
                      marginTop: "4px",
                    }}
                  >
                    <span style={{ fontWeight: 600, display: "block" }}>
                      Date & Time
                    </span>
                    {ev.date || "TBD"}{" "}
                    {ev.startAt && (
                      <span style={{ color: "#6b7280" }}>@ {ev.startAt}</span>
                    )}
                  </div>

                  <div style={{ fontSize: "14px", color: "#4b5563" }}>
                    <span style={{ fontWeight: 600, display: "block" }}>
                      Location
                    </span>
                    {ev.location_at || ev.location || ev.locationTag || "N/A"}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div
                  style={{
                    padding: "12px 16px",
                    background: "#f9fafb",
                    borderTop: "1px solid #eaeaea",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "16px",
                  }}
                >
                  <button
                    onClick={() => setEditingEvent(ev)}
                    style={actionBtnStyle}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(ev.id)}
                    style={{ ...actionBtnStyle, color: "#ef4444" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* When editing an event, overlay the exact same modal used for creation */}
      {editingEvent && (
        <EventModal
          initialEvent={editingEvent}
          onClose={() => {
            setEditingEvent(null);
            loadEvents(); // Refresh data table after modal closes
          }}
        />
      )}
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  color: "#2563eb",
  padding: 0,
};
// "use client";

// import React, { useState, useEffect } from "react";
// import { EventModal } from "./addEvent";
// import { generateExport, deleteEventFromStore } from "../arcgisRefs";

// export default function EventsDashboardManager() {
//   const [isOpen, setIsOpen] = useState(false);

//   return (
//     <>
//       <button
//         onClick={() => setIsOpen(true)}
//         style={{
//           color: "#ffffff",
//           position: "absolute",
//           bottom: "-60px",
//           right: "calc(50% - 154px)",
//           zIndex: "999",
//           padding: "10px 14px",
//           fontWeight: "900",
//           border: "4px solid black",
//           borderRadius: "10%",
//           backgroundColor: "#005bff",
//           cursor: "pointer",
//         }}
//       >
//         Manage Events
//       </button>

//       {isOpen && <DashboardOverlay onClose={() => setIsOpen(false)} />}
//     </>
//   );
// }

// function DashboardOverlay({ onClose }: { onClose: () => void }) {
//   const [events, setEvents] = useState<any[]>([]);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [editingEvent, setEditingEvent] = useState<any | null>(null);

//   // Load all events currently on the map/store
//   const loadEvents = () => {
//     const { events: mapEvents } = generateExport();
//     // Re-map the exported format back to a flat structure for the UI
//     const flatEvents = mapEvents.map((e) => ({
//       id: e.attributes.id,
//       event_name: e.attributes.event_name,
//       description: e.attributes.description,
//       date: e.attributes.date,
//       startAt: e.attributes.startAt,
//       endAt: e.attributes.endAt,
//       location_at: e.attributes.location_at || e.attributes.locationTag,
//       poster_url: e.attributes.poster_url,
//       geometry: e.geometry,
//       original: e.attributes.original,
//     }));
//     setEvents(flatEvents);
//   };

//   useEffect(() => {
//     loadEvents();
//   }, []);

//   const handleDelete = (id: string) => {
//     if (confirm("Are you sure you want to remove this event from the map?")) {
//       deleteEventFromStore(id);
//       loadEvents(); // refresh local list
//     }
//   };

//   const filteredEvents = events.filter(
//     (ev) =>
//       ev.event_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       ev.location_at?.toLowerCase().includes(searchQuery.toLowerCase()),
//   );

//   return (
//     <div
//       style={{
//         position: "fixed",
//         inset: 0,
//         backgroundColor: "rgba(255, 255, 255, 0.95)", // High opacity white backdrop
//         zIndex: 999998, // Just below the EventModal
//         display: "flex",
//         flexDirection: "column",
//         padding: "40px",
//       }}
//     >
//       <div
//         style={{
//           display: "flex",
//           justifyContent: "space-between",
//           alignItems: "center",
//           marginBottom: "24px",
//         }}
//       >
//         <h1 style={{ margin: 0, fontSize: "28px" }}>Event Dashboard</h1>
//         <button
//           onClick={onClose}
//           style={{
//             padding: "8px 16px",
//             fontSize: "16px",
//             cursor: "pointer",
//             borderRadius: "6px",
//             border: "1px solid #ccc",
//           }}
//         >
//           Close Dashboard
//         </button>
//       </div>

//       <input
//         type="text"
//         placeholder="Search events by name or location..."
//         value={searchQuery}
//         onChange={(e) => setSearchQuery(e.target.value)}
//         style={{
//           padding: "12px",
//           fontSize: "16px",
//           width: "100%",
//           maxWidth: "400px",
//           marginBottom: "20px",
//           borderRadius: "6px",
//           border: "1px solid #ccc",
//         }}
//       />

//       <div
//         style={{
//           flex: 1,
//           overflow: "auto",
//           border: "1px solid #eaeaea",
//           borderRadius: "8px",
//           background: "white",
//         }}
//       >
//         <table
//           style={{
//             width: "100%",
//             borderCollapse: "collapse",
//             textAlign: "left",
//           }}
//         >
//           <thead style={{ background: "#f9fafb", position: "sticky", top: 0 }}>
//             <tr>
//               <th style={thStyle}>Event Name</th>
//               <th style={thStyle}>Date & Time</th>
//               <th style={thStyle}>Location</th>
//               <th style={thStyle}>Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {filteredEvents.length === 0 ? (
//               <tr>
//                 <td
//                   colSpan={4}
//                   style={{
//                     padding: "24px",
//                     textAlign: "center",
//                     color: "#6b7280",
//                   }}
//                 >
//                   No events found.
//                 </td>
//               </tr>
//             ) : (
//               filteredEvents.map((ev) => (
//                 <tr key={ev.id} style={{ borderBottom: "1px solid #eaeaea" }}>
//                   <td style={tdStyle}>
//                     <strong>{ev.event_name}</strong>
//                   </td>
//                   <td style={tdStyle}>
//                     {ev.date}{" "}
//                     <span style={{ color: "gray" }}>
//                       {ev.startAt && `@ ${ev.startAt}`}
//                     </span>
//                   </td>
//                   <td style={tdStyle}>{ev.location_at || "N/A"}</td>
//                   <td style={tdStyle}>
//                     <button
//                       onClick={() => setEditingEvent(ev)}
//                       style={actionBtnStyle}
//                     >
//                       Edit
//                     </button>
//                     <button
//                       onClick={() => handleDelete(ev.id)}
//                       style={{ ...actionBtnStyle, color: "#ef4444" }}
//                     >
//                       Delete
//                     </button>
//                   </td>
//                 </tr>
//               ))
//             )}
//           </tbody>
//         </table>
//       </div>

//       {/* When editing an event, overlay the exact same modal used for creation */}
//       {editingEvent && (
//         <EventModal
//           initialEvent={editingEvent}
//           onClose={() => {
//             setEditingEvent(null);
//             loadEvents(); // Refresh data table after modal closes
//           }}
//         />
//       )}
//     </div>
//   );
// }

// const thStyle: React.CSSProperties = {
//   padding: "16px",
//   borderBottom: "2px solid #eaeaea",
//   fontWeight: 600,
//   color: "#374151",
// };
// const tdStyle: React.CSSProperties = { padding: "16px" };
// const actionBtnStyle: React.CSSProperties = {
//   background: "transparent",
//   border: "none",
//   cursor: "pointer",
//   fontWeight: 600,
//   color: "#2563eb",
//   marginRight: "16px",
// };
