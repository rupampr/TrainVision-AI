import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AuthPage from "./AuthPage";

export default async function RootPage() {
  const session = await getSession();

  if (session) {
    redirect("/home");
  }

  return <AuthPage />;
}
