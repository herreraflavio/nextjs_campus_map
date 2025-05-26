import { NextResponse } from "next/server";
import { findUserByEmail, createUser } from "@/lib/userModel";

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ message: "Missing fields" }, { status: 400 });
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { message: "Email already registered" },
        { status: 409 }
      );
    }
    await createUser({ email, password });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
