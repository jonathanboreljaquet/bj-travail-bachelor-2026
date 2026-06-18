"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import {
  COURT_TYPE_LABELS,
  dayKey,
  formatDate,
  formatTime,
} from "@/lib/format";
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

export type MatchesFilters = {
  city: string;
  courtType: string;
  date: string;
  level: string;
  levelTolerance: string;
  minPrice: string;
  maxPrice: string;
  minDuration: string;
  maxDuration: string;
  minSpots: string;
  equipment: string;
};

type MatchesViewProps = {
  matches: Match[];
  slotGroups: AvailableSlotGroup[];
  filters: MatchesFilters;
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

  const fieldClass =
    "rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500";

  function onFilter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    const textKeys = [
      "city",
      "courtType",
      "date",
      "level",
      "levelTolerance",
      "minPrice",
      "maxPrice",
      "minDuration",
      "maxDuration",
      "minSpots",
    ];
    for (const key of textKeys) {
      const value = (form.get(key) as string | null)?.trim();
      if (value) params.set(key, value);
    }
    if (form.get("equipment") === "true") params.set("equipment", "true");
    router.push(`/matches${params.toString() ? `?${params}` : ""}`);
  }

  const hasFilters = Object.values(filters).some(Boolean);

  const totalSlots = slotGroups.reduce(
    (sum, group) => sum + group.availableSlots.length,
    0,
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-2">
      <form
        onSubmit={onFilter}
        className="flex flex-shrink-0 flex-wrap items-center gap-2"
      >
        <input
          name="city"
          defaultValue={filters.city}
          placeholder="Ville (ex : Lancy)"
          className={fieldClass}
        />
        <select
          name="courtType"
          defaultValue={filters.courtType}
          className={fieldClass}
        >
          <option value="">Tous les terrains</option>
          <option value="INDOOR">Intérieur</option>
          <option value="OUTDOOR">Extérieur</option>
          <option value="COVERED">Couvert</option>
        </select>
        <input
          type="date"
          name="date"
          defaultValue={filters.date}
          className={fieldClass}
        />
        <input
          type="number"
          name="level"
          defaultValue={filters.level}
          placeholder="Niveau (1-10)"
          min={1}
          max={10}
          step={0.5}
          className={`${fieldClass} w-32`}
        />
        <input
          type="number"
          name="levelTolerance"
          defaultValue={filters.levelTolerance}
          placeholder="± tolérance"
          min={0}
          step={0.5}
          className={`${fieldClass} w-28`}
        />
        <input
          type="number"
          name="minPrice"
          defaultValue={filters.minPrice}
          placeholder="Prix min €"
          min={0}
          className={`${fieldClass} w-28`}
        />
        <input
          type="number"
          name="maxPrice"
          defaultValue={filters.maxPrice}
          placeholder="Prix max €"
          min={0}
          className={`${fieldClass} w-28`}
        />
        <input
          type="number"
          name="minDuration"
          defaultValue={filters.minDuration}
          placeholder="Durée min (min)"
          min={0}
          step={30}
          className={`${fieldClass} w-36`}
        />
        <input
          type="number"
          name="maxDuration"
          defaultValue={filters.maxDuration}
          placeholder="Durée max (min)"
          min={0}
          step={30}
          className={`${fieldClass} w-36`}
        />
        <input
          type="number"
          name="minSpots"
          defaultValue={filters.minSpots}
          placeholder="Places min"
          min={1}
          max={4}
          className={`${fieldClass} w-28`}
        />
        <label className="flex items-center gap-2 px-1 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="equipment"
            value="true"
            defaultChecked={filters.equipment === "true"}
            className="h-4 w-4 rounded border-black/20 text-emerald-600 focus:ring-emerald-500"
          />
          Matériel sur place
        </label>
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
  const averageLevel =
    match.participants.length > 0
      ? match.participants.reduce((sum, p) => sum + p.user.level, 0) /
        match.participants.length
      : null;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold leading-tight">
            {match.court.club.name}
          </h3>
          <p className="text-xs text-black/50">
            📍 {match.court.club.city} · {match.court.name}
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
        {match.court.hasEquipmentBox ? <p>🎒 Matériel sur place</p> : null}
        {averageLevel !== null ? (
          <p>🎾 Niveau moyen {averageLevel.toFixed(1)}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSpots }).map((_, idx) => (
          <span
            key={idx}
            className={`h-2.5 w-2.5 rounded-full ${
              idx < match.participants.length ? "bg-emerald-500" : "bg-zinc-200"
            }`}
          />
        ))}
        <span className="ml-1 text-xs text-black/50">
          {isFull
            ? "Complet"
            : `${match.availableSpots} place${match.availableSpots > 1 ? "s" : ""} libre${match.availableSpots > 1 ? "s" : ""}`}
        </span>
      </div>

      {match.participants.length > 0 ? (
        <div className="text-xs text-black/60">
          <p className="mb-1 font-medium text-black/70">Joueurs inscrits</p>
          <ul className="flex flex-wrap gap-1.5">
            {match.participants.map((participant, idx) => (
              <li key={idx} className="rounded-full bg-zinc-100 px-2 py-0.5">
                {participant.user.firstname} · niveau{" "}
                {participant.user.level.toFixed(1)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <JoinButton
        matchId={match.id}
        matchLabel={`${match.court.club.name}, ${formatDate(match.startTime)} à ${formatTime(match.startTime)}`}
        disabled={isFull}
      />
    </Card>
  );
}

function JoinButton({
  matchId,
  matchLabel,
  disabled,
}: {
  matchId: number;
  matchLabel: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  function confirm() {
    setResult(null);
    startTransition(async () => {
      const r = await joinMatchAction(matchId);
      setResult(r);
      setConfirming(false);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="mt-auto space-y-1.5">
      <Button
        onClick={() => setConfirming(true)}
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

      {confirming ? (
        <ConfirmDialog
          title="Confirmer l'inscription"
          message={`Veux-tu rejoindre le match ${matchLabel} ?`}
          confirmLabel="Confirmer"
          pending={isPending}
          onConfirm={confirm}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <Card className="p-5">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-2 text-sm text-black/70">{message}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              Annuler
            </Button>
            <Button onClick={onConfirm} disabled={pending}>
              {pending ? <Spinner className="h-4 w-4" /> : null}
              {confirmLabel}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

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
  const [confirmSlot, setConfirmSlot] = useState<AvailableSlot | null>(null);
  const [, startTransition] = useTransition();

  const slotsByDay = groupSlotsByDay(availableSlots);

  function confirm() {
    if (!confirmSlot) return;
    const { startTime, endTime } = confirmSlot;
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
      setConfirmSlot(null);
      if (r.ok) router.refresh();
    });
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold leading-tight">{court.club.name}</h3>
          <p className="text-xs text-black/50">
            📍 {court.club.city} · {court.name} · {court.pricePerPerson}€ / pers
            {court.hasEquipmentBox ? " · 🎒 Matériel sur place" : ""}
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
                  onClick={() => setConfirmSlot(slot)}
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

      {confirmSlot ? (
        <ConfirmDialog
          title="Confirmer la création du match"
          message={`Créer un match sur ${court.club.name} le ${formatDate(confirmSlot.startTime)} de ${formatTime(confirmSlot.startTime)} à ${formatTime(confirmSlot.endTime)} ?`}
          confirmLabel="Confirmer"
          pending={pendingKey !== null}
          onConfirm={confirm}
          onCancel={() => setConfirmSlot(null)}
        />
      ) : null}
    </Card>
  );
}
