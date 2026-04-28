"use client";

import { useState } from "react";
import { login } from "@/app/actions/auth";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-sm border border-black/10">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            Connexion
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Connecte-toi pour accéder à Padel Context
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={onSubmit}>
          {errorMessage && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {errorMessage}
            </div>
          )}

          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <input
                type="email"
                name="email"
                required
                className="w-full rounded-md border border-black/15 px-3 py-2 text-sm focus:border-black outline-none"
                placeholder="Adresse email"
              />
            </div>
            <div>
              <input
                type="password"
                name="password"
                required
                className="w-full rounded-md border border-black/15 px-3 py-2 text-sm focus:border-black outline-none"
                placeholder="Mot de passe"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isLoading ? "Connexion en cours..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
