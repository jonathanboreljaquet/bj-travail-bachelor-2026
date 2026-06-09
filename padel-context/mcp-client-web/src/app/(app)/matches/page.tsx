import { getAvailableSlots, getOpenMatches } from "@/lib/api";
import MatchesView from "./MatchesView";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const city = first(sp.city);
  const courtType = first(sp.courtType);

  const params = new URLSearchParams();
  if (city) params.set("city", city);
  if (courtType) params.set("courtType", courtType);

  // Lectures côté serveur (le navigateur ne joint pas l'API Docker directement).
  const [matches, slotGroups] = await Promise.all([
    getOpenMatches(params),
    getAvailableSlots(params),
  ]);

  return (
    <MatchesView
      matches={matches}
      slotGroups={slotGroups}
      filters={{ city, courtType }}
    />
  );
}
