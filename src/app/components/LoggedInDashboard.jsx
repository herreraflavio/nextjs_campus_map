"use client";

import { signOut } from "next-auth/react";

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
    </div>
  );
}
