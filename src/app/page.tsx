// import ArcGISWrapper from "./components/ArcGISWrapper";
// import Button from "@/app/components/button/Button";
// import SaveMap from "@/app/components/button/SaveMap";
// import SketchTool from "./components/SketchTool";
// export default function HomePage() {
//   return (
//     <>
//       <Button />
//       <SaveMap />
//       <SketchTool />
//       <ArcGISWrapper />
//     </>
//   );
// }

// /app/page.jsx
import { auth } from "@/lib/auth";
import LoggedInDashboard from "./components/LoggedInDashboard";
import AuthForm from "./components/AuthForm"; // login + register

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    alert("no session");
    return <AuthForm />;
  }

  return <LoggedInDashboard user={session.user} />;
}
