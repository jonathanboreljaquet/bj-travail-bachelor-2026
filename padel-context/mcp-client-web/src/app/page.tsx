import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function RootPage() {
  // Déjà connecté ? On entre directement dans l'application.
  const jwt = (await cookies()).get("padel_context_jwt_token")?.value;
  if (jwt) redirect("/chatbot");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-white px-4">
      <div className="max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-3xl shadow-lg shadow-emerald-600/20">
          🎾
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Padel Context
          </h1>
          <p className="text-base text-gray-600">
            Réserve un terrain, crée ou rejoins un match — avec l&apos;aide d&apos;un
            assistant IA ou directement à la main.
          </p>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          Se connecter
        </Link>
      </div>
    </div>
  );
}
