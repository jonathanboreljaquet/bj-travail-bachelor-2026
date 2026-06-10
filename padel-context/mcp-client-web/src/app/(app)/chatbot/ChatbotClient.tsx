"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import {
  type CreateMatchFromSlotInput,
  isSensitiveTool,
  type JoinOpenMatchInput,
  SENSITIVE_TOOL_LABELS,
} from "@/lib/sensitive-tools";
import { useUsage } from "@/components/UsageProvider";
import { Button, Card } from "@/components/ui";
import MarkdownMessage from "./MarkdownMessage";

export default function ChatbotClient() {
  const [input, setInput] = useState("");
  const { refresh: refreshUsage } = useUsage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, addToolApprovalResponse } =
    useChat({
      transport: new DefaultChatTransport({ api: "/api/chat" }),
      sendAutomaticallyWhen:
        lastAssistantMessageIsCompleteWithApprovalResponses,
    });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isSending = status === "submitted" || status === "streaming";
  const showThinkingIndicator =
    isSending && messages[messages.length - 1]?.role === "user";

  // Vrai tant qu'un appel d'outil attend une décision humaine (HITL).
  // Tant que c'est le cas, l'appel d'outil est "ouvert" (sans résultat) :
  // envoyer un message intercalerait un tour utilisateur entre l'appel et
  // son résultat, ce que l'API refuse ("Tool result is missing...").
  const hasPendingApproval = useMemo(
    () =>
      messages.some(
        (message) =>
          message.role === "assistant" &&
          message.parts?.some(
            (part) =>
              isToolUIPart(part) && part.state === "approval-requested",
          ),
      ),
    [messages],
  );

  const canSend = useMemo(
    () => input.trim().length > 0 && !isSending && !hasPendingApproval,
    [input, isSending, hasPendingApproval],
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if (!value || hasPendingApproval) return;

    setInput("");
    await sendMessage({ text: value });
    await refreshUsage();
  }

  return (
    <div className="flex h-full flex-col">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-black/50">
              <span className="text-3xl">🎾</span>
              <p className="max-w-sm">
                Exemple&nbsp;: «&nbsp;Je souhaite rejoindre un match le 28 avril
                2026 sur un terrain couvert à Lancy&nbsp;».
              </p>
            </div>
          ) : null}

          {messages.map((message) => {
            return (
              <div
                key={message.id}
                className={`w-fit max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "ml-auto bg-emerald-600 text-white"
                    : "bg-zinc-100 text-zinc-900"
                }`}
              >
                <p className="mb-1 text-[11px] uppercase tracking-wide opacity-70">
                  {message.role === "user" ? "Toi" : "Assistant"}
                </p>

                {message.parts?.map((part, i) => {
                  if (part.type === "text") {
                    return message.role !== "user" ? (
                      <MarkdownMessage key={i} content={part.text || "..."} />
                    ) : (
                      <p key={i} className="whitespace-pre-wrap">
                        {part.text || ""}
                      </p>
                    );
                  }

                  if (!isToolUIPart(part)) {
                    return null;
                  }

                  const toolName = getToolName(part);

                  if (!isSensitiveTool(toolName)) {
                    return null;
                  }

                  // === TRADUCTION VISUELLE DES OUTILS ===
                  // Titre + détails "user friendly" pour la carte de validation.
                  const friendlyTitle = SENSITIVE_TOOL_LABELS[toolName];
                  let friendlyDetails: ReactNode = null;

                  if (toolName === "create-match-from-slot") {
                    const input = (part.input ?? {}) as CreateMatchFromSlotInput;
                    const start = input.startTime
                      ? new Date(input.startTime).toLocaleTimeString("fr-CH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : null;
                    const end = input.endTime
                      ? new Date(input.endTime).toLocaleTimeString("fr-CH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : null;
                    friendlyDetails = (
                      <dl className="space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-zinc-500">Action</dt>
                          <dd className="font-medium text-zinc-800">
                            Créer une nouvelle partie
                          </dd>
                        </div>
                        {start && end && (
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-zinc-500">Créneau</dt>
                            <dd className="font-medium text-zinc-800">
                              {start} – {end}
                            </dd>
                          </div>
                        )}
                        {input.courtId != null && (
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-zinc-500">Terrain</dt>
                            <dd className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 ring-1 ring-zinc-200">
                              ID {input.courtId}
                            </dd>
                          </div>
                        )}
                      </dl>
                    );
                  } else if (toolName === "join-open-match") {
                    const input = (part.input ?? {}) as JoinOpenMatchInput;
                    friendlyDetails = (
                      <dl className="space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-zinc-500">Action</dt>
                          <dd className="font-medium text-zinc-800">
                            Rejoindre une partie existante
                          </dd>
                        </div>
                        {input.matchId && (
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-zinc-500">Match</dt>
                            <dd className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 ring-1 ring-zinc-200">
                              ID {input.matchId}
                            </dd>
                          </div>
                        )}
                      </dl>
                    );
                  }

                  // Rendu selon l'état réel du tool part (AI SDK v6).
                  switch (part.state) {
                    // Préparation de l'appel : le modèle génère les arguments,
                    // AVANT toute demande de validation.
                    case "input-streaming":
                    case "input-available":
                      return (
                        <div
                          key={i}
                          className="mt-3 flex items-center gap-2 text-xs font-medium text-zinc-500"
                        >
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                          Préparation de l&apos;action…
                        </div>
                      );

                    // L'utilisateur vient de répondre : l'action est ACCEPTÉE
                    // (ou refusée) mais PAS encore exécutée — l'outil s'exécute.
                    case "approval-responded":
                      if (part.approval?.approved === false) {
                        // Refus : l'état "output-denied" prend le relais juste après.
                        return null;
                      }
                      return (
                        <div
                          key={i}
                          className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-xs font-medium text-emerald-800"
                        >
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
                          Action validée — exécution en cours, merci de
                          patienter…
                        </div>
                      );

                    // Demande de validation humaine (HITL).
                    case "approval-requested":
                      return (
                        <div
                          key={i}
                          className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md ring-1 ring-black/5"
                        >
                          <div className="flex items-start gap-3 border-b border-zinc-100 bg-gradient-to-br from-emerald-50 to-white px-4 py-3.5">
                            <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-emerald-600/10 text-emerald-600 ring-1 ring-emerald-600/20">
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.8}
                                className="h-5 w-5"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                                />
                              </svg>
                            </span>
                            <div>
                              <h4 className="text-sm font-semibold text-zinc-900">
                                Confirmation requise
                              </h4>
                              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                                Vérifie les informations ci-dessous avant de
                                valider cette action.
                              </p>
                            </div>
                          </div>

                          <div className="px-4 py-4">
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5">
                              <h5 className="mb-3 text-sm font-semibold text-zinc-800">
                                {friendlyTitle}
                              </h5>
                              {friendlyDetails}
                            </div>

                            <div className="mt-4 flex gap-2.5">
                              <Button
                                variant="primary"
                                className="flex-1"
                                onClick={() =>
                                  addToolApprovalResponse({
                                    id: part.approval.id,
                                    approved: true,
                                  })
                                }
                              >
                                Confirmer
                              </Button>
                              <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={() =>
                                  addToolApprovalResponse({
                                    id: part.approval.id,
                                    approved: false,
                                  })
                                }
                              >
                                Annuler
                              </Button>
                            </div>
                          </div>
                        </div>
                      );

                    // L'outil a bien été exécuté. On insiste sur le fait que la
                    // réponse de l'assistant arrive juste en dessous (ne pas
                    // quitter avant de l'avoir lue).
                    case "output-available":
                      return (
                        <div
                          key={i}
                          className="mt-3 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"
                        >
                          <span className="mt-px flex h-4 w-4 flex-none items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                            ✓
                          </span>
                          <div>
                            <strong className="font-semibold">
                              {friendlyTitle} — action validée
                            </strong>
                            <p className="mt-0.5 text-emerald-700">
                              Le récapitulatif s&apos;affiche dans la réponse de
                              l&apos;assistant ci-dessous.
                            </p>
                          </div>
                        </div>
                      );

                    // Action refusée par l'utilisateur (rien n'a été exécuté).
                    case "output-denied":
                      return (
                        <div
                          key={i}
                          className="mt-3 flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600"
                        >
                          <span className="mt-px flex h-4 w-4 flex-none items-center justify-center rounded-full bg-zinc-400 text-[10px] font-bold text-white">
                            ✕
                          </span>
                          <div>
                            <strong className="font-semibold text-zinc-700">
                              Action refusée
                            </strong>
                            <p className="mt-0.5">
                              Tu as annulé cette action : aucune opération
                              n&apos;a été effectuée.
                            </p>
                          </div>
                        </div>
                      );

                    // Échec d'exécution de l'outil.
                    case "output-error":
                      return (
                        <div
                          key={i}
                          className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
                        >
                          <span className="mt-px flex h-4 w-4 flex-none items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            !
                          </span>
                          <div>
                            <strong className="font-semibold">
                              Échec de l&apos;action
                            </strong>
                            <p className="mt-0.5 text-red-700">
                              Une erreur est survenue, l&apos;action n&apos;a pas
                              pu être réalisée.
                            </p>
                          </div>
                        </div>
                      );

                    default:
                      return null;
                  }
                })}
              </div>
            );
          })}

          {showThinkingIndicator ? (
            <div className="w-fit max-w-[90%] rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-900">
              <p className="mb-1 text-[11px] uppercase tracking-wide opacity-70">
                Assistant
              </p>
              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-zinc-500 [animation-delay:-0.3s]" />
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-zinc-500 [animation-delay:-0.15s]" />
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-zinc-500" />
              </div>
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>
      </Card>

      <form onSubmit={onSubmit} className="mt-3 flex flex-shrink-0 gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={hasPendingApproval}
          placeholder={
            hasPendingApproval
              ? "Confirme ou annule l'action ci-dessus pour continuer..."
              : "Pose une question sur les terrains, créneaux ou matchs..."
          }
          className="flex-1 rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-black/40"
        />
        <Button type="submit" disabled={!canSend}>
          {isSending ? "Envoi..." : "Envoyer"}
        </Button>
      </form>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {(() => {
            try {
              const parsed = JSON.parse(error.message);
              return parsed.error || error.message;
            } catch {
              return error.message;
            }
          })()}
        </p>
      ) : null}
    </div>
  );
}
