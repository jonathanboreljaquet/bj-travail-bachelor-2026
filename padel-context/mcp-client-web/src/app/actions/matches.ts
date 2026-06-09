"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { API_URL } from "@/lib/config";

export type ActionResult = { ok: boolean; message: string };

async function getJwt(): Promise<string | undefined> {
  return (await cookies()).get("padel_context_jwt_token")?.value;
}

// Rejoindre un match existant (écriture => Server Action).
export async function joinMatchAction(matchId: number): Promise<ActionResult> {
  const jwt = await getJwt();
  if (!jwt) return { ok: false, message: "Utilisateur non authentifié." };

  const res = await fetch(`${API_URL}/api/matches/${matchId}/join`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
  });

  const payload = (await res.json().catch(() => null)) as {
    message?: string;
  } | null;

  if (!res.ok) {
    return { ok: false, message: payload?.message ?? "Échec de l'inscription." };
  }

  revalidatePath("/matches");
  return { ok: true, message: payload?.message ?? "Inscription réussie !" };
}

// Créer un match depuis un créneau libre (écriture => Server Action).
export async function createMatchFromSlotAction(input: {
  courtId: number;
  startTime: string;
  endTime: string;
}): Promise<ActionResult> {
  const jwt = await getJwt();
  if (!jwt) return { ok: false, message: "Utilisateur non authentifié." };

  const res = await fetch(`${API_URL}/api/matches/from-slot`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await res.json().catch(() => null)) as {
    message?: string;
  } | null;

  if (!res.ok) {
    return { ok: false, message: payload?.message ?? "Échec de la création." };
  }

  revalidatePath("/matches");
  return { ok: true, message: payload?.message ?? "Match créé avec succès !" };
}
