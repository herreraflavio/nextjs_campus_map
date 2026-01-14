// pages/index.jsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import "./Home.css";
export default function Home({ user }) {
  const [maps, setMaps] = useState([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newMapName, setNewMapName] = useState("");

  // Fetch all maps from our API
  useEffect(() => {
    fetch("/api/maps")
      .then((res) => res.json())
      .then((data) => setMaps(data));
  }, []);

  // Toggle showing/hiding the "New Map" form
  const onCreateClick = () => {
    setShowNewForm(true);
    setNewMapName("");
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const trimmed = newMapName.trim();
    if (!trimmed) return;

    const res = await fetch("/api/maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }), // ◀ pass the name
    });

    if (res.ok) {
      const created = await res.json();
      setMaps((prev) => [...prev, created]);
      setShowNewForm(false);
      setNewMapName("");
    } else {
      console.error("Map creation failed:", await res.text());
    }
  };

  // Cancel handler for the "New Map" form
  const handleCreateCancel = () => {
    setShowNewForm(false);
    setNewMapName("");
  };

  // Delete an existing map
  const deleteMap = async (id) => {
    // Simple confirmation using window.confirm
    if (!window.confirm("Are you sure you want to delete this map?")) return;
    const res = await fetch(`/api/maps/${id}`, {
      method: "DELETE",
    });
    if (res.status === 204) {
      setMaps((prev) => prev.filter((m) => m._id !== id));
    }
  };

  const openMap = async (id) => {
    window.open(`/maps/${id}`, "_blank").focus();
  };

  // Toggle privacy (public ↔ private)
  const toggleVisibility = async (id, current) => {
    const updated = { isPrivate: !current };
    const res = await fetch(`/api/maps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      const newMap = await res.json();
      console.log(newMap);
      setMaps((prev) => prev.map((m) => (m._id === id ? newMap : m)));
    }
  };

  // Duplicate: fetch the map, then create a copy under a new ID
  const duplicateMap = async (id) => {
    const getRes = await fetch(`/api/maps/${id}`);
    if (!getRes.ok) return;
    const original = await getRes.json();

    const copyData = {
      name: original.name + " (copy)",
      thumbnailUrl: original.thumbnailUrl,
      url: original.url,
      isPrivate: original.isPrivate,
    };
    const postRes = await fetch("/api/maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(copyData),
    });
    if (postRes.ok) {
      const newMap = await postRes.json();
      setMaps((prev) => [...prev, newMap]);
    }
  };

  // Rename: prompt for a new name, then PATCH
  const renameMap = async (id, oldName) => {
    const newName = window.prompt("Enter a new name:", oldName);
    if (!newName || newName === oldName) return;

    const updated = { name: newName };
    const res = await fetch(`/api/maps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      const newMap = await res.json();
      setMaps((prev) => prev.map((m) => (m.id === id ? newMap : m)));
    }
  };

  // Share: copy a shareable link
  const shareMap = (id) => {
    const shareUrl = `${window.location.origin}/maps/${id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      // You can swap this alert for a more sophisticated toast later
      window.alert("Shareable URL copied to clipboard:\n" + shareUrl);
    });
  };

  // Download: redirect to our “download” endpoint
  const downloadMap = (id) => {
    window.location.href = `/api/maps/${id}/download`;
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

      {maps.length === 0 ? (
        <p>No maps found.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {maps.map((map) => (
            <div
              key={map._id}
              style={{
                display: "flex",
                alignItems: "center",
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "1rem",
              }}
            >
              <div style={{ marginRight: "1rem" }}>
                {map.thumbnailUrl ? (
                  <img
                    src={map.thumbnailUrl}
                    alt="thumbnail"
                    width={100}
                    height={100}
                    style={{ objectFit: "cover", borderRadius: "4px" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100px",
                      height: "100px",
                      background: "#f0f0f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#999",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                    }}
                  >
                    No Image
                  </div>
                )}
              </div>

              <div style={{ flexGrow: 1 }}>
                <h2 style={{ margin: "0 0 0.5rem 0" }}>{map.title}</h2>
                <p style={{ margin: "0.25rem 0" }}>
                  <strong>URL:</strong>{" "}
                  {map.url ? (
                    <a
                      href={map.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#0070f3" }}
                    >
                      {map.url}
                    </a>
                  ) : (
                    <span style={{ color: "#777" }}>—</span>
                  )}
                </p>
                <p
                  style={{
                    margin: "0.25rem 0",
                    fontSize: "0.9rem",
                    color: "#555",
                  }}
                >
                  Created: {new Date(map.createdAt).toLocaleString()}
                </p>
                <p
                  style={{
                    margin: "0.25rem 0",
                    fontSize: "0.9rem",
                    color: "#555",
                  }}
                >
                  Last Edited: {new Date(map.updatedAt).toLocaleString()}
                </p>
                <p
                  style={{
                    margin: "0.25rem 0",
                    fontSize: "0.9rem",
                    color: "#555",
                  }}
                >
                  Visibility:{" "}
                  {map.isPrivate ? (
                    <span style={{ color: "#c00" }}>Private</span>
                  ) : (
                    <span style={{ color: "#090" }}>Public</span>
                  )}
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <button
                  onClick={() => openMap(map._id)}
                  // href={`/maps/${map._id}`}
                  style={{
                    padding: "0.4rem 0.6rem",
                    background: "green",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    textDecoration: "none",
                    textAlign: "center",
                    width: "100px",
                  }}
                >
                  Open Map
                </button>
                <button
                  onClick={() => deleteMap(map._id)}
                  style={{
                    padding: "0.4rem 0.6rem",
                    background: "#e00",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    width: "100px",
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => toggleVisibility(map._id, map.isPrivate)}
                  style={{
                    padding: "0.4rem 0.6rem",
                    background: "#555",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    width: "100px",
                  }}
                >
                  {map.isPrivate ? "Make Public" : "Make Private"}
                </button>
                {/* <button
                  onClick={() => shareMap(map.id)}
                  style={{
                    padding: "0.4rem 0.6rem",
                    background: "#0070f3",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Share
                </button> */}
                {/* <button
                  onClick={() => downloadMap(map.id)}
                  style={{
                    padding: "0.4rem 0.6rem",
                    background: "#333",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Download
                </button> */}
                {/* <button
                  onClick={() => duplicateMap(map.id)}
                  style={{
                    padding: "0.4rem 0.6rem",
                    background: "#0a0",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Duplicate
                </button> */}
                {/* <button
                  onClick={() => renameMap(map.id, map.name)}
                  style={{
                    padding: "0.4rem 0.6rem",
                    background: "#0066cc",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Rename
                </button> */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Replace with your actual auth logic or remove if not needed
export async function getServerSideProps(context) {
  const user = { email: "user@example.com" };
  return { props: { user } };
}
