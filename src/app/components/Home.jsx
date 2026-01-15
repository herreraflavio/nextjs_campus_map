// pages/index.jsx
"use client";

import React, { useState } from "react";
import { signOut } from "next-auth/react";
import MapList from "./shards/LoadMaps"; // Import the child
import "./Home.css";

export default function Home({ user }) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [newMapName, setNewMapName] = useState("");
  // This state holds the MOST RECENTLY created map to pass to the child
  const [lastCreatedMap, setLastCreatedMap] = useState(null);

  // Toggle showing/hiding the "New Map" form
  const onCreateClick = () => {
    setShowNewForm(true);
    setNewMapName("");
  };

  const handleCreateCancel = () => {
    setShowNewForm(false);
    setNewMapName("");
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const trimmed = newMapName.trim();
    if (!trimmed) return;

    const res = await fetch("/api/maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });

    if (res.ok) {
      const created = await res.json();

      // Pass the new map down to the child
      setLastCreatedMap(created);

      setShowNewForm(false);
      setNewMapName("");
    } else {
      console.error("Map creation failed:", await res.text());
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ flexGrow: "1" }}>
          <h2>Welcome {user.email}</h2>
        </div>
        <div style={{ padding: "16px" }}>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="signout"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* “Create New Map” button */}
      {!showNewForm && (
        <button
          onClick={onCreateClick}
          style={{
            margin: "1rem 0",
            padding: "0.5rem 1rem",
            background: "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          + Create New Map
        </button>
      )}

      {/* Inline form for creating a new map */}
      {showNewForm && (
        <form
          onSubmit={handleCreateSubmit}
          style={{
            margin: "1rem 0",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <input
            type="text"
            placeholder="Map name"
            value={newMapName}
            onChange={(e) => setNewMapName(e.target.value)}
            style={{
              padding: "0.5rem",
              border: "1px solid #ccc",
              borderRadius: "4px",
              flexGrow: 1,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "0.5rem 1rem",
              background: "#0a0",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCreateCancel}
            style={{
              padding: "0.5rem 1rem",
              background: "#555",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </form>
      )}

      {/* Child Component: 
         Handles loading the list and updating when 'addedMap' changes 
      */}
      <MapList addedMap={lastCreatedMap} />
    </div>
  );
}
