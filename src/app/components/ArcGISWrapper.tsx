"use client";
import dynamic from "next/dynamic";

const ArcGISMap = dynamic(() => import("./ArcGISMap"), {
  ssr: false,
});

export default function ArcGISWrapper() {
  return <ArcGISMap />;
}
