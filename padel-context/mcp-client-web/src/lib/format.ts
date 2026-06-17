import type { CourtType, MatchStatus } from "./types";

const TZ = "Europe/Zurich";

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

function tzOffsetMs(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

function zurichWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = tzOffsetMs(TZ, new Date(guess));
  return new Date(guess - offset);
}

export function zurichDayToUtcRange(
  dateStr: string,
): { startIso: string; endIso: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return {
    startIso: zurichWallToUtc(year, month, day, 0, 0, 0).toISOString(),
    endIso: zurichWallToUtc(year, month, day, 23, 59, 59).toISOString(),
  };
}
