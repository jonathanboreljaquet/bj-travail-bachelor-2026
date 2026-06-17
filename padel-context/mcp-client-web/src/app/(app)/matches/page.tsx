import { getAvailableSlots, getOpenMatches } from "@/lib/api";
import { zurichDayToUtcRange } from "@/lib/format";
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

  const filters = {
    city: first(sp.city),
    courtType: first(sp.courtType),
    date: first(sp.date),
    level: first(sp.level),
    levelTolerance: first(sp.levelTolerance),
    minPrice: first(sp.minPrice),
    maxPrice: first(sp.maxPrice),
    minDuration: first(sp.minDuration),
    maxDuration: first(sp.maxDuration),
    minSpots: first(sp.minSpots),
    equipment: first(sp.equipment),
  };

  const common = new URLSearchParams();
  if (filters.city) common.set("city", filters.city);
  if (filters.courtType) common.set("courtType", filters.courtType);
  if (filters.equipment === "true") common.set("hasEquipmentBox", "true");
  if (filters.minPrice) common.set("minPricePerPerson", filters.minPrice);
  if (filters.maxPrice) common.set("maxPricePerPerson", filters.maxPrice);
  if (filters.minDuration) common.set("minSlotDuration", filters.minDuration);
  if (filters.maxDuration) common.set("maxSlotDuration", filters.maxDuration);

  const range = filters.date ? zurichDayToUtcRange(filters.date) : null;

  const matchParams = new URLSearchParams(common);
  if (range) {
    matchParams.set("startTimeFrom", range.startIso);
    matchParams.set("startTimeTo", range.endIso);
  }
  if (filters.level) {
    matchParams.set("participantAverageLevel", filters.level);
    if (filters.levelTolerance) {
      matchParams.set(
        "participantAverageLevelTolerance",
        filters.levelTolerance,
      );
    }
  }
  if (filters.minSpots) matchParams.set("minAvailableSpots", filters.minSpots);

  const slotParams = new URLSearchParams(common);
  if (range) {
    slotParams.set("timeFrom", range.startIso);
    slotParams.set("timeTo", range.endIso);
  }

  const [matches, slotGroups] = await Promise.all([
    getOpenMatches(matchParams),
    getAvailableSlots(slotParams),
  ]);

  return (
    <MatchesView matches={matches} slotGroups={slotGroups} filters={filters} />
  );
}
