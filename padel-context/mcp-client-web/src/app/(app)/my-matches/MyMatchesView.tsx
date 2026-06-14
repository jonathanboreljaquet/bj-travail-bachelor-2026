"use client";

import { useState } from "react";
import { Badge, Card } from "@/components/ui";
import {
  COURT_TYPE_LABELS,
  MATCH_STATUS_LABELS,
  formatDate,
  formatTime,
} from "@/lib/format";
import type { CourtType, MatchStatus, MyMatch } from "@/lib/types";

const COURT_TONE: Record<CourtType, "emerald" | "sky" | "amber"> = {
  INDOOR: "sky",
  OUTDOOR: "amber",
  COVERED: "emerald",
};

const STATUS_TONE: Record<MatchStatus, "emerald" | "sky" | "neutral"> = {
  OPEN: "emerald",
  COMPLETED: "sky",
  CANCELED: "neutral",
};

export default function MyMatchesView({ matches }: { matches: MyMatch[] }) {
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  // Instant figé au premier rendu pour départager passé / à venir.
  const [now] = useState(() => Date.now());

  // L'API renvoie les matchs triés par date de début croissante.
  const upcoming = matches.filter(
    (match) => new Date(match.startTime).getTime() >= now,
  );
  // Historique : du plus récent au plus ancien.
  const past = matches
    .filter((match) => new Date(match.startTime).getTime() < now)
    .reverse();

  const list = view === "upcoming" ? upcoming : past;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-2">
      {/* Sous-onglets */}
      <div className="inline-flex flex-shrink-0 gap-1 self-start rounded-xl bg-zinc-100 p-1">
        <SubTab
          active={view === "upcoming"}
          onClick={() => setView("upcoming")}
          label={`À venir (${upcoming.length})`}
        />
        <SubTab
          active={view === "past"}
          onClick={() => setView("past")}
          label={`Historique (${past.length})`}
        />
      </div>

      {list.length === 0 ? (
        <EmptyState
          emoji="🎾"
          text={
            view === "upcoming"
              ? "Tu n'as aucun match à venir."
              : "Aucun match dans ton historique."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((match) => (
            <MyMatchCard key={match.id} match={match} />
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

function MyMatchCard({ match }: { match: MyMatch }) {
  const { court } = match;
  const totalSpots = match.participants.length + match.availableSpots;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold leading-tight">{court.name}</h3>
          <p className="text-xs text-black/50">
            {court.club.name} · {court.club.city}
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <Badge tone={STATUS_TONE[match.status]}>
            {MATCH_STATUS_LABELS[match.status]}
          </Badge>
          <Badge tone={COURT_TONE[court.type]}>
            {COURT_TYPE_LABELS[court.type]}
          </Badge>
        </div>
      </div>

      <div className="space-y-1 text-sm text-black/80">
        <p className="capitalize">📅 {formatDate(match.startTime)}</p>
        <p>
          ⏰ {formatTime(match.startTime)}–{formatTime(match.endTime)} (
          {court.slotDuration} min)
        </p>
        <p>💶 {court.pricePerPerson}€ / personne</p>
        {court.hasEquipmentBox ? <p>🧰 Matériel disponible</p> : null}
      </div>

      {/* Occupation des places */}
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
          {match.participants.length}/{totalSpots} joueur
          {totalSpots > 1 ? "s" : ""}
        </span>
      </div>

      {/* Liste des participants (prénom + niveau) */}
      <div className="flex flex-wrap gap-1.5">
        {match.participants.map((participant, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
          >
            {participant.user.firstname}
            <span className="text-zinc-400">niv. {participant.user.level}</span>
          </span>
        ))}
      </div>
    </Card>
  );
}
