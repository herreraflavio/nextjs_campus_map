"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      setMsg("Account created! Redirecting to login…");
      setTimeout(() => router.push("/login"), 1500);
    } else {
      const { message } = await res.json();
      setMsg(message || "Error registering");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-center">Register</h1>
        {msg && <p className="text-center text-sm">{msg}</p>}
        <input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input input-bordered w-full"
          required
        />
        <input
          type="password"
          placeholder="Min 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input input-bordered w-full"
          minLength="6"
          required
        />
        <button className="btn btn-primary w-full">Create account</button>
        <p className="text-center text-sm">
          Already registered?{" "}
          <a href="/login" className="link">
            Log in
          </a>
        </p>
      </form>
    </div>
  );
}
