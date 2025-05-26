// src/lib/auth.js
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import client from "./db";
import bcrypt from "bcrypt";

/** @type {import("next-auth").AuthOptions} */
export const authConfig = {
  adapter: MongoDBAdapter(client),
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const users = client.db().collection("users");
        const user = await users.findOne({ email: credentials.email });
        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        // Return a minimal, serializable user object
        return { id: user._id.toString(), email: user.email };
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
};

// NextAuth v5 returns an object with `handlers` and `auth`
const nextAuthInstance = NextAuth(authConfig);
export const { handlers, auth } = nextAuthInstance;
