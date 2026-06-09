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

  const canSend = useMemo(
    () => input.trim().length > 0 && !isSending,
    [input, isSending],
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;

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
                    friendlyDetails = (
                      <ul className="space-y-1.5 text-xs text-black/80">
                        <li>
                          <strong>Action :</strong> Créer une nouvelle session
                          de jeu.
                        </li>
                        {input.startTime && input.endTime && (
                          <li>
                            ⏰ <strong>Créneau :</strong> De{" "}
                            {new Date(input.startTime).toLocaleTimeString(
                              "fr-CH",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                            à{" "}
                            {new Date(input.endTime).toLocaleTimeString(
                              "fr-CH",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </li>
                        )}
                        {input.club && (
                          <li>
                            📍 <strong>Lieu :</strong> {input.club}
                          </li>
                        )}
                      </ul>
                    );
                  } else if (toolName === "join-open-match") {
                    const input = (part.input ?? {}) as JoinOpenMatchInput;
                    friendlyDetails = (
                      <ul className="space-y-1.5 text-xs text-black/80">
                        <li>
                          <strong>Action :</strong> Rejoindre une partie
                          existante.
                        </li>
                        {input.matchId && (
                          <li className="w-fit rounded bg-zinc-100 px-1 py-0.5 font-mono">
                            🆔 Match ID : {input.matchId}
                          </li>
                        )}
                      </ul>
                    );
                  }

                  // Rendu selon l'état réel du tool part (AI SDK v6).
                  switch (part.state) {
                    // Préparation des arguments, puis traitement post-validation.
                    case "input-streaming":
                    case "input-available":
                    case "approval-responded":
                      return (
                        <div
                          key={i}
                          className="mt-3 flex items-center gap-2 text-xs font-medium text-zinc-500"
                        >
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                          Préparation : {friendlyTitle}...
                        </div>
                      );

                    // Demande de validation humaine (HITL).
                    case "approval-requested":
                      return (
                        <div
                          key={i}
                          className="mt-3 overflow-hidden rounded-xl border border-black/15 bg-white text-black shadow-sm"
                        >
                          <div className="border-b border-black/5 bg-zinc-50 px-4 py-3">
                            <h4 className="flex items-center gap-2 text-sm font-semibold">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-600">
                                ℹ️
                              </span>
                              Confirmation requise
                            </h4>
                            <p className="ml-7 mt-1 text-xs text-black/60">
                              L&apos;assistant souhaite effectuer l&apos;action
                              suivante pour toi.
                            </p>
                          </div>

                          <div className="px-4 py-3">
                            <div className="mb-4 rounded-md border border-emerald-100/60 bg-emerald-50/50 p-3">
                              <h5 className="mb-2 text-sm font-medium text-emerald-900">
                                {friendlyTitle}
                              </h5>
                              {friendlyDetails}
                            </div>

                            <div className="flex gap-2">
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
                                Confirmer l&apos;action
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

                    // Action réussie.
                    case "output-available":
                      return (
                        <div
                          key={i}
                          className="mt-3 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
                        >
                          <span className="text-base leading-none text-emerald-600">
                            ✓
                          </span>
                          <div>
                            <strong>{friendlyTitle}</strong>
                            <p className="mt-0.5 opacity-80">
                              L&apos;action a été effectuée avec succès !
                            </p>
                          </div>
                        </div>
                      );

                    // Action refusée par l'utilisateur.
                    case "output-denied":
                      return (
                        <div
                          key={i}
                          className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800"
                        >
                          <span className="text-base leading-none text-red-600">
                            ✗
                          </span>
                          <div>
                            <strong>Action annulée</strong>
                            <p className="mt-0.5 opacity-80">
                              L&apos;action n&apos;a pas été effectuée.
                            </p>
                          </div>
                        </div>
                      );

                    // Échec d'exécution de l'outil.
                    case "output-error":
                      return (
                        <div
                          key={i}
                          className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800"
                        >
                          <span className="text-base leading-none text-red-600">
                            ✗
                          </span>
                          <div>
                            <strong>Échec de l&apos;action</strong>
                            <p className="mt-0.5 opacity-80">
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
          placeholder="Pose une question sur les terrains, créneaux ou matchs..."
          className="flex-1 rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
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
