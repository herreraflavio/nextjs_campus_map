"use client";

export default function OpenMap() {
  const openMap = () => {
    alert("opening map");
  };

  return <button onClick={() => openMap()}>Open Map</button>;
}
