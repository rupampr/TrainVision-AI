
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AuthPage from "./AuthPage";

export default async function RootPage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/home");
  }

  return <AuthPage />;
}
