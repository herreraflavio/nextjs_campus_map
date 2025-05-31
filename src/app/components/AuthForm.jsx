// "use client";

// import { useState } from "react";
// import { signIn } from "next-auth/react";
// import { useRouter } from "next/navigation";

// export default function AuthForm() {
//   const [mode, setMode] = useState("login"); // "login" or "register"
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [error, setError] = useState("");
//   const router = useRouter();

//   async function handleSubmit(e) {
//     e.preventDefault();
//     setError("");

//     if (mode === "login") {
//       const res = await signIn("credentials", {
//         email,
//         password,
//         redirect: false,
//       });

//       if (res?.error) {
//         setError("Invalid credentials");
//       } else if (res?.ok) {
//         router.refresh(); // reload dashboard view
//       }
//     } else {
//       // Register
//       try {
//         const res = await fetch("/api/auth/register", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ email, password }),
//         });

//         if (!res.ok) {
//           const data = await res.json();
//           setError(data.message || "Registration failed");
//         } else {
//           // auto login after successful registration
//           await signIn("credentials", {
//             email,
//             password,
//             redirect: false,
//           });
//           router.refresh();
//         }
//       } catch (err) {
//         setError("Server error");
//       }
//     }
//   }

//   return (
//     <div className="min-h-screen flex items-center justify-center">
//       <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
//         <h1 className="text-2xl font-semibold text-center">
//           {mode === "login" ? "Login" : "Register"}
//         </h1>

//         {error && <p className="text-red-600 text-sm">{error}</p>}

//         <input
//           type="email"
//           placeholder="email@example.com"
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//           className="input input-bordered w-full"
//           required
//         />

//         <input
//           type="password"
//           placeholder="••••••••"
//           value={password}
//           onChange={(e) => setPassword(e.target.value)}
//           className="input input-bordered w-full"
//           required
//         />

//         <button type="submit" className="btn btn-primary w-full">
//           {mode === "login" ? "Sign in" : "Register"}
//         </button>

//         <p className="text-center text-sm">
//           {mode === "login" ? "No account?" : "Already have an account?"}{" "}
//           <button
//             type="button"
//             className="link"
//             onClick={() =>
//               setMode((prev) => (prev === "login" ? "register" : "login"))
//             }
//           >
//             {mode === "login" ? "Register" : "Login"}
//           </button>
//         </p>
//       </form>
//     </div>
//   );
// }
"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
} from "@mui/material";

export default function AuthForm() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (mode === "login") {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid credentials");
      } else if (res?.ok) {
        router.refresh();
      }
    } else {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.message || "Registration failed");
        } else {
          await signIn("credentials", { email, password, redirect: false });
          router.refresh();
        }
      } catch (err) {
        setError("Server error");
      }
    }
  }

  return (
    <Container
      component="main"
      maxWidth="xs"
      style={{
        display: "flex",
      }}
    >
      <Box
        sx={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: "#ffffffd9",
          padding: "23px",
          borderRadius: "25px",
        }}
      >
        <Typography component="h1" variant="h5">
          {mode === "login" ? "Login" : "Register"}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: "100%", mt: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            {mode === "login" ? "Sign In" : "Register"}
          </Button>
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Typography variant="body2">
              {mode === "login" ? "No account? " : "Already have an account? "}
              <Link
                component="button"
                variant="body2"
                type="button"
                onClick={() =>
                  setMode((prev) => (prev === "login" ? "register" : "login"))
                }
              >
                {mode === "login" ? "Register" : "Login"}
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}
