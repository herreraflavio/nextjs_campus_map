"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
} from "@mui/material";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid credentials");
      return;
    }

    if (res?.ok) {
      router.refresh();
    }
  }

  return (
    <Container component="main" maxWidth="xs" style={{ display: "flex" }}>
      <Box
        sx={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: "#ffffffd9",
          padding: "23px",
          borderRadius: "25px",
          width: "100%",
        }}
      >
        <Typography component="h1" variant="h5">
          Sign In
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: "100%", mt: 2 }}>
            {error}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit}
          noValidate
          sx={{ mt: 1, width: "100%" }}
        >
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
            Sign In
          </Button>

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Typography variant="body2">
              No account?{" "}
              <Link component={NextLink} href="/register" variant="body2">
                Register
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}
