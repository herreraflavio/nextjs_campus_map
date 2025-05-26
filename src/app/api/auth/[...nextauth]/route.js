import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

// NextAuth() → { handlers, auth, signIn, signOut, ... }
const { handlers } = NextAuth(authOptions);

// Export the *actual functions* for each HTTP verb
export const GET = handlers.GET;
export const POST = handlers.POST;
