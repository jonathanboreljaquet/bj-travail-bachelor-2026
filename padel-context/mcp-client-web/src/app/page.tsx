"use client";

import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Padel Context
        </h1>

        <p className="text-base text-gray-600">
          Assistant IA propulsé par MCP pour créer ou participer à des matchs de
          Padel.
        </p>

        <button
          onClick={() => router.push("/login")}
          className="mt-4 rounded-md bg-black px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-gray-800 transition-colors"
        >
          Se connecter
        </button>
      </div>
    </div>
  );
}
