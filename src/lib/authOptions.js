import Credentials from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "./mongodb.js";
import { verifyUser } from "./userModel.js";

export const authOptions = {
  adapter: MongoDBAdapter(clientPromise),
  secret: process.env.AUTH_SECRET,

  session: { strategy: "jwt" },

  providers: [
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = await verifyUser(credentials);
        if (user) return { id: user._id.toString(), email: user.email };
        return null;
      },
    }),
    // add OAuth providers here if needed
  ],

  pages: {
    signIn: "/login",
    error: "/login", // redirects back on auth errors
  },
};
