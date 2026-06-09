"use client";

import { useState } from "react";
import { login } from "@/app/actions/auth";
import { Button, Card } from "@/components/ui";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    const formData = new FormData(event.currentTarget);
    const result = await login(formData);

    if (result?.error) {
      setErrorMessage(result.error);
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 via-gray-50 to-gray-50 px-4">
      <Card className="w-full max-w-md space-y-8 p-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-2xl shadow-sm">
            🎾
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">
              Connexion
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Connecte-toi pour accéder à Padel Context
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <input
            type="email"
            name="email"
            required
            className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
            placeholder="Adresse email"
          />
          <input
            type="password"
            name="password"
            required
            className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
            placeholder="Mot de passe"
          />

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Connexion en cours..." : "Se connecter"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
