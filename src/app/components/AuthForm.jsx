"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // or "register"
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();

    if (mode === "register") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        alert("Registration failed");
        return;
      }
    }

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (res.ok) {
      router.refresh(); // refresh to load dashboard
    } else {
      alert("Login failed");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">
        {mode === "login" ? "Login" : "Register"}
      </h1>
      <input
        type="email"
        placeholder="Email"
        className="w-full border p-2"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        className="w-full border p-2"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit" className="w-full bg-blue-500 text-white p-2">
        {mode === "login" ? "Login" : "Register"}
      </button>
      <p
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        className="text-sm text-blue-600 cursor-pointer"
      >
        {mode === "login"
          ? "Don't have an account? Register"
          : "Already have an account? Login"}
      </p>
    </form>
  );
}
