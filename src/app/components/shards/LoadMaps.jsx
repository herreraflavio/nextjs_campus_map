// components/MapList.jsx
"use client";

import React, { useState, useEffect } from "react";
import Loading from "../loading/Loading";

export default function MapList({ addedMap }) {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Handle Loading Maps
  useEffect(() => {
    fetch("/api/maps")
      .then((res) => res.json())
      .then((data) => {
        setMaps(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load maps", err);
        setLoading(false);
      });
  }, []);

  // 2. Watch for new maps created by the Parent
  useEffect(() => {
    if (addedMap) {
      setMaps((prev) => {
        // Prevent adding duplicates if strict mode triggers twice
        if (prev.find((m) => m._id === addedMap._id)) return prev;
        return [...prev, addedMap];
      });
    }
  }, [addedMap]);

  // 3. Logic: Delete an existing map
  const deleteMap = async (id) => {
    if (!window.confirm("Are you sure you want to delete this map?")) return;
    const res = await fetch(`/api/maps/${id}`, {
      method: "DELETE",
    });
    if (res.status === 204) {
      setMaps((prev) => prev.filter((m) => m._id !== id));
    }
  };

  // 4. Logic: Toggle privacy
  const toggleVisibility = async (id, current) => {
    const updated = { isPrivate: !current };
    const res = await fetch(`/api/maps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      const newMap = await res.json();
      setMaps((prev) => prev.map((m) => (m._id === id ? newMap : m)));
    }
  };

  const openMap = (id) => {
    window.open(`/maps/${id}`, "_blank").focus();
  };

  if (loading && maps.length === 0) return <Loading />;

  return (
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
          {/* Thumbnail Section */}
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

          {/* Info Section */}
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
              style={{ margin: "0.25rem 0", fontSize: "0.9rem", color: "#555" }}
            >
              Created: {new Date(map.createdAt).toLocaleString()}
            </p>
            <p
              style={{ margin: "0.25rem 0", fontSize: "0.9rem", color: "#555" }}
            >
              Last Edited: {new Date(map.updatedAt).toLocaleString()}
            </p>
            <p
              style={{ margin: "0.25rem 0", fontSize: "0.9rem", color: "#555" }}
            >
              Visibility:{" "}
              {map.isPrivate ? (
                <span style={{ color: "#c00" }}>Private</span>
              ) : (
                <span style={{ color: "#090" }}>Public</span>
              )}
            </p>
          </div>

          {/* Actions Section */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <button
              onClick={() => openMap(map._id)}
              style={{
                padding: "0.4rem 0.6rem",
                background: "green",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.85rem",
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
          </div>
        </div>
      ))}
    </div>
  );
}
