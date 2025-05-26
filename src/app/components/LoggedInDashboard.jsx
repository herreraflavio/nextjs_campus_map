"use client";

import { signOut } from "next-auth/react";
import ArcGISWrapper from "@/app/components/ArcGISWrapper";
import Button from "@/app/components/button/Button";
import SaveMap from "@/app/components/button/SaveMap";
import SketchTool from "@/app/components/SketchTool";

export default function LoggedInDashboard({ user }) {
  return (
    <div className="p-4">
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
      <ArcGISWrapper />
    </div>
  );
}
