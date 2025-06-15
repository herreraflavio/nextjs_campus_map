"use client";

export default function ExportMap() {
  const exportMap = () => {
    alert("exporting map");
  };

  return <button onClick={() => exportMap()}>Export Map</button>;
}
