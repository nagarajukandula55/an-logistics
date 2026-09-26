import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Landing point right after signIn() — one shared /login page/form serves
// both staff and self-service customer accounts, and the role isn't known
// until authorize() has already run, so the redirect target is decided
// here instead of being hardcoded into loginAction.
export default async function PostLoginPage() {
  const session = await auth();
  if (session?.user?.role === "CUSTOMER") {
    redirect("/portal");
  }
  redirect("/dashboard");
}
