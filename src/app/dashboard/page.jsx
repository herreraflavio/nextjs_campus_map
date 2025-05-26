// example: /app/dashboard/page.jsx
"use client";

import { useSession } from "next-auth/react";

export default function Dashboard() {
  const { data: session, status } = useSession();
  if (status === "loading") return <p>Loading…</p>;
  if (!session) return <p>You must be logged in to view this page.</p>;
  return <h1>Welcome, {session.user.email}!</h1>;
}
