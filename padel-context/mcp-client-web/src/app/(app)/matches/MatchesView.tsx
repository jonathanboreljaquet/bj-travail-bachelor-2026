"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { COURT_TYPE_LABELS, dayKey, formatDate, formatTime } from "@/lib/format";
import type {
  AvailableSlot,
  AvailableSlotGroup,
  CourtType,
  Match,
} from "@/lib/types";
import {
  type ActionResult,
  createMatchFromSlotAction,
  joinMatchAction,
} from "@/app/actions/matches";

type MatchesViewProps = {
  matches: Match[];
  slotGroups: AvailableSlotGroup[];
  filters: { city: string; courtType: string };
};

const COURT_TONE: Record<CourtType, "emerald" | "sky" | "amber"> = {
  INDOOR: "sky",
  OUTDOOR: "amber",
  COVERED: "emerald",
};

export default function MatchesView({
  matches,
  slotGroups,
  filters,
}: MatchesViewProps) {
  const router = useRouter();
  const [view, setView] = useState<"open" | "slots">("open");

  function onFilter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    const city = (form.get("city") as string)?.trim();
    const courtType = form.get("courtType") as string;
    if (city) params.set("city", city);
    if (courtType) params.set("courtType", courtType);
    router.push(`/matches${params.toString() ? `?${params}` : ""}`);
  }

  const hasFilters = Boolean(filters.city || filters.courtType);

  // Total des créneaux (slotGroups = terrains ; chaque terrain a N créneaux).
  const totalSlots = slotGroups.reduce(
    (sum, group) => sum + group.availableSlots.length,
    0,
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-2">
      {/* Barre de filtres */}
      <form
        onSubmit={onFilter}
        className="flex flex-shrink-0 flex-wrap items-center gap-2"
      >
        <input
          name="city"
          defaultValue={filters.city}
          placeholder="Ville (ex : Lancy)"
          className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <select
          name="courtType"
          defaultValue={filters.courtType}
          className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
        >
          <option value="">Tous les terrains</option>
          <option value="INDOOR">Intérieur</option>
          <option value="OUTDOOR">Extérieur</option>
          <option value="COVERED">Couvert</option>
        </select>
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/matches")}
          >
            Réinitialiser
          </Button>
        ) : null}
      </form>

      {/* Sous-onglets */}
      <div className="inline-flex flex-shrink-0 gap-1 self-start rounded-xl bg-zinc-100 p-1">
        <SubTab
          active={view === "open"}
          onClick={() => setView("open")}
          label={`Matchs ouverts (${matches.length})`}
        />
        <SubTab
          active={view === "slots"}
          onClick={() => setView("slots")}
          label={`Créneaux libres (${totalSlots})`}
        />
      </div>

      {/* Contenu */}
      {view === "open" ? (
        matches.length === 0 ? (
          <EmptyState
            emoji="🔍"
            text="Aucun match ouvert ne correspond à ta recherche."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )
      ) : slotGroups.length === 0 ? (
        <EmptyState
          emoji="📅"
          text="Aucun créneau libre ne correspond à ta recherche."
        />
      ) : (
        <div className="space-y-3">
          {slotGroups.map((group) => (
            <SlotGroupCard key={group.court.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-white text-emerald-700 shadow-sm"
          : "text-zinc-600 hover:text-zinc-900"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 bg-white/50 py-12 text-center text-sm text-black/50">
      <span className="text-3xl">{emoji}</span>
      <p>{text}</p>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const totalSpots = match.participants.length + match.availableSpots;
  const isFull = match.availableSpots <= 0;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold leading-tight">{match.court.name}</h3>
          <p className="text-xs text-black/50">
            {match.court.club.name} · {match.court.club.city}
          </p>
        </div>
        <Badge tone={COURT_TONE[match.court.type]}>
          {COURT_TYPE_LABELS[match.court.type]}
        </Badge>
      </div>

      <div className="space-y-1 text-sm text-black/80">
        <p className="capitalize">📅 {formatDate(match.startTime)}</p>
        <p>
          ⏰ {formatTime(match.startTime)}–{formatTime(match.endTime)}
        </p>
        <p>💶 {match.court.pricePerPerson}€ / personne</p>
      </div>

      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSpots }).map((_, idx) => (
          <span
            key={idx}
            className={`h-2.5 w-2.5 rounded-full ${
              idx < match.participants.length
                ? "bg-emerald-500"
                : "bg-zinc-200"
            }`}
          />
        ))}
        <span className="ml-1 text-xs text-black/50">
          {isFull
            ? "Complet"
            : `${match.availableSpots} place${match.availableSpots > 1 ? "s" : ""} libre${match.availableSpots > 1 ? "s" : ""}`}
        </span>
      </div>

      <JoinButton matchId={match.id} disabled={isFull} />
    </Card>
  );
}

function JoinButton({
  matchId,
  disabled,
}: {
  matchId: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  function onClick() {
    setResult(null);
    startTransition(async () => {
      const r = await joinMatchAction(matchId);
      setResult(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="mt-auto space-y-1.5">
      <Button
        onClick={onClick}
        disabled={disabled || isPending}
        className="w-full"
      >
        {isPending ? <Spinner className="h-4 w-4" /> : null}
        {disabled ? "Complet" : "Rejoindre"}
      </Button>
      {result ? (
        <p
          className={`text-xs ${result.ok ? "text-emerald-700" : "text-red-600"}`}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}

// Regroupe les créneaux par jour (les créneaux arrivent déjà triés de l'API,
// donc les jours ressortent dans l'ordre chronologique).
function groupSlotsByDay(
  slots: AvailableSlot[],
): { key: string; slots: AvailableSlot[] }[] {
  const byDay = new Map<string, AvailableSlot[]>();
  for (const slot of slots) {
    const key = dayKey(slot.startTime);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(slot);
    else byDay.set(key, [slot]);
  }
  return [...byDay.entries()].map(([key, daySlots]) => ({
    key,
    slots: daySlots,
  }));
}

function SlotGroupCard({ group }: { group: AvailableSlotGroup }) {
  const router = useRouter();
  const { court, availableSlots } = group;
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [, startTransition] = useTransition();

  const slotsByDay = groupSlotsByDay(availableSlots);

  function create(startTime: string, endTime: string) {
    setPendingKey(startTime);
    setResult(null);
    startTransition(async () => {
      const r = await createMatchFromSlotAction({
        courtId: court.id,
        startTime,
        endTime,
      });
      setResult(r);
      setPendingKey(null);
      if (r.ok) router.refresh();
    });
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold leading-tight">{court.name}</h3>
          <p className="text-xs text-black/50">
            {court.club.name} · {court.club.city} · {court.pricePerPerson}€ /
            pers
          </p>
        </div>
        <Badge tone={COURT_TONE[court.type]}>
          {COURT_TYPE_LABELS[court.type]}
        </Badge>
      </div>

      <div className="mt-3 space-y-3">
        {slotsByDay.map((day) => (
          <div key={day.key}>
            <p className="mb-1.5 text-xs font-semibold capitalize text-black/50">
              {formatDate(day.slots[0].startTime)}
            </p>
            <div className="flex flex-wrap gap-2">
              {day.slots.map((slot) => (
                <button
                  key={slot.startTime}
                  onClick={() => create(slot.startTime, slot.endTime)}
                  disabled={pendingKey !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
                  {pendingKey === slot.startTime ? (
                    <Spinner className="h-3 w-3" />
                  ) : (
                    <span className="text-emerald-600">＋</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {result ? (
        <p
          className={`mt-2 text-xs ${result.ok ? "text-emerald-700" : "text-red-600"}`}
        >
          {result.message}
        </p>
      ) : null}
    </Card>
  );
}
