"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }

  try {
    const res = await fetch("http://api:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      return { error: "Identifiants incorrects." };
    }

    const data = await res.json();
    const jwtToken = data.token;

    const cookieStore = await cookies();
    cookieStore.set({
      name: "padel_context_jwt_token",
      value: jwtToken,
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  } catch (error) {
    console.error("Erreur serveur lors de la connexion:", error);
    return { error: "Impossible de joindre le serveur d'authentification." };
  }
  redirect("/chatbot");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("padel_context_jwt_token");
  redirect("/login");
}
