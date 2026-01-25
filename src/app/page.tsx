import { auth } from "@/lib/auth";
import Home from "@/app/components/Home";
import LandingPage from "./components/LandingPage";
export default async function HomePage() {
  const session = await auth();

  if (!session) {
    return <LandingPage />;
  }

  return <Home user={session.user} />;
}
