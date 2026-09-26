"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", {
      username,
      password,
      // /post-login reads the fresh session and forwards staff to /orders,
      // customers to /portal — one shared login page/form for both, since
      // the role isn't known until after authorize() runs.
      redirectTo: "/post-login",
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid username or password" };
    }
    throw err;
  }
}
