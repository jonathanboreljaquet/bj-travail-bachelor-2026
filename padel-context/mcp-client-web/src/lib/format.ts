import type { CourtType, MatchStatus } from "./types";

const TZ = "Europe/Zurich";

// Les dates de l'API sont en UTC : on les affiche dans le fuseau local (Zurich).
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: TZ,
  });
}

// Clé de regroupement par jour (dans le fuseau local), au format YYYY-MM-DD.
export function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", { timeZone: TZ });
}

export const COURT_TYPE_LABELS: Record<CourtType, string> = {
  INDOOR: "Intérieur",
  OUTDOOR: "Extérieur",
  COVERED: "Couvert",
};

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  OPEN: "Ouvert",
  COMPLETED: "Complet",
  CANCELED: "Annulé",
};
