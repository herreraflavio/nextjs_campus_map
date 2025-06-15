"use client";

export default function ShareMap() {
  const shareMap = () => {
    alert("sharing map");
  };

  return <button onClick={() => shareMap()}>Share Map</button>;
}
