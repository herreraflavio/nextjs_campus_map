import { auth } from "@/lib/auth";
import LoggedInDashboard from "./components/LoggedInDashboard";
import AuthForm from "./components/AuthForm"; // login + register
import Home from "@/app/components/Home";
export default async function HomePage() {
  const session = await auth();

  if (!session) {
    return (
      <div
        style={{
          backgroundImage:
            'url("https://news.ucmerced.edu/sites/news.ucmerced.edu/files/news/image/morning_190708-4.gif")',
          backgroundSize: "cover",
          width: "100%",
          height: "100%",
        }}
      >
        <AuthForm />
      </div>
    );
  }

  //  return <LoggedInDashboard user={session.user} />;
  return <Home user={session.user} />;
}
