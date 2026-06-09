import "server-only";
import { cookies } from "next/headers";
import { API_URL } from "./config";
import type { AvailableSlotGroup, Match } from "./types";

// Helpers de lecture côté serveur : on récupère le JWT depuis le cookie et on
// interroge l'API interne. Réservé au serveur (le navigateur ne joint pas l'API
// Docker directement).
async function authedGet<T>(path: string, search?: URLSearchParams): Promise<T | null> {
  const jwt = (await cookies()).get("padel_context_jwt_token")?.value;
  const qs = search && [...search].length > 0 ? `?${search.toString()}` : "";

  try {
    const res = await fetch(`${API_URL}${path}${qs}`, {
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      cache: "no-store",
    });

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (error) {
    console.error(`Erreur lors de l'appel à ${path}:`, error);
    return null;
  }
}

export async function getOpenMatches(search?: URLSearchParams): Promise<Match[]> {
  return (await authedGet<Match[]>("/api/matches", search)) ?? [];
}

export async function getAvailableSlots(
  search?: URLSearchParams,
): Promise<AvailableSlotGroup[]> {
  return (await authedGet<AvailableSlotGroup[]>("/api/available-slots", search)) ?? [];
}
