import { auth } from "@/lib/auth";
import LoggedInDashboard from "./components/LoggedInDashboard";
import AuthForm from "./components/AuthForm"; // login + register

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    return <AuthForm />;
  }

  return <LoggedInDashboard user={session.user} />;
}
