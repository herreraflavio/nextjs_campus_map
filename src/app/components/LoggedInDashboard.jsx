"use client";

import { signOut } from "next-auth/react";
import ArcGISWrapper from "@/app/components/ArcGISWrapper";
import Button from "@/app/components/button/Button";
import SaveMap from "@/app/components/button/SaveMap";
import SketchTool from "@/app/components/SketchTool";
import Sidebar from "./map/Sidebar";

export default function LoggedInDashboard({ user }) {
  return (
    <div
      className="p-4"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user.email}</h1>
        <button
          onClick={() => signOut()}
          className="mt-4 bg-red-500 text-white p-2"
        >
          Logout
        </button>
        <Button />
        <SaveMap />
        <SketchTool />
      </div>
      <div style={{ flexGrow: "1" }}>
        <div
          style={{
            display: "flex",
            height: "100%",
            width: "100%",
            position: "relative",
          }}
        >
          <div>
            side navbar goes here
            <Sidebar />
          </div>
          <ArcGISWrapper />
        </div>
      </div>
    </div>
  );
}
