import { cookies } from "next/headers";

export const runtime = "nodejs";

const apiUrl = "http://api:3000";

export async function GET() {
  const cookieStore = await cookies();
  const jwtToken = cookieStore.get("padel_context_jwt_token")?.value;

  if (!jwtToken) {
    return Response.json(
      { error: "Utilisateur non authentifié." },
      { status: 401 },
    );
  }

  const response = await fetch(`${apiUrl}/api/llm-usage/me`, {
    headers: {
      Authorization: `Bearer ${jwtToken}`,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return Response.json(
      { error: payload?.message ?? "Impossible de récupérer le quota." },
      { status: response.status },
    );
  }

  return Response.json(payload);
}
