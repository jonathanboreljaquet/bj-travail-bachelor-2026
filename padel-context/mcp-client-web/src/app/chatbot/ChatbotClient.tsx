"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { logoutAction } from "@/app/actions/auth";
import {
  isSensitiveTool,
  SENSITIVE_TOOL_LABELS,
} from "@/lib/sensitive-tools";
import MarkdownMessage from "./MarkdownMessage";

type TokenUsage = {
  currentMonthTokens: number;
  monthlyTokenLimit: number;
};

type ChatbotClientProps = {
  initialTokenUsage: TokenUsage | null;
  initialTokenUsageError: string | null;
};

export default function ChatbotClient({
  initialTokenUsage,
  initialTokenUsageError,
}: ChatbotClientProps) {
  const [input, setInput] = useState("");
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(
    initialTokenUsage,
  );
  const [tokenUsageError, setTokenUsageError] = useState<string | null>(
    initialTokenUsageError,
  );
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

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

  const refreshUsage = useCallback(async () => {
    setIsLoadingUsage(true);
    setTokenUsageError(null);

    try {
      const response = await fetch("/api/usage", { cache: "no-store" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setTokenUsage(null);
        setTokenUsageError(payload?.error ?? "Quota indisponible.");
        return;
      }

      if (
        typeof payload?.currentMonthTokens !== "number" ||
        typeof payload?.monthlyTokenLimit !== "number"
      ) {
        setTokenUsage(null);
        setTokenUsageError("Quota indisponible.");
        return;
      }

      setTokenUsage({
        currentMonthTokens: payload.currentMonthTokens,
        monthlyTokenLimit: payload.monthlyTokenLimit,
      });
    } catch (fetchError) {
      console.error("Erreur lors du chargement du quota:", fetchError);
      setTokenUsage(null);
      setTokenUsageError("Quota indisponible.");
    } finally {
      setIsLoadingUsage(false);
    }
  }, []);

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

  async function handleLogout() {
    await logoutAction();
  }

  return (
    <div className="mx-auto flex h-screen w-full max-w-4xl flex-col px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center justify-between border-b border-black/10 pb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold">
            Padel Context - MVP MCP Client
          </h1>
          <p className="mt-1 text-sm text-black/60">
            Assistant IA connecté au serveur MCP.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-xs text-black/60">
            {tokenUsage ? (
              <div className="font-medium text-black/70">
                Tokens {tokenUsage.currentMonthTokens.toLocaleString("fr-CH")} /{" "}
                {tokenUsage.monthlyTokenLimit.toLocaleString("fr-CH")}
              </div>
            ) : isLoadingUsage ? (
              <div>Chargement du quota...</div>
            ) : tokenUsageError ? (
              <div className="text-red-600">{tokenUsageError}</div>
            ) : null}
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden rounded-md border border-black/10 bg-white">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="text-sm text-black/60">
              Exemple: &quot;Je souhaite rejoindre un match le 28 avril 2026 sur
              un terrain couvert à Lancy&quot;.
            </p>
          ) : null}

          {messages.map((message) => {
            return (
              <div
                key={message.id}
                className={`w-fit max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "ml-auto bg-black text-white"
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

                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const p = part as any;
                  const toolName =
                    p.toolName ||
                    p.toolInvocation?.toolName ||
                    (p.type.startsWith("tool-")
                      ? p.type.replace("tool-", "")
                      : "inconnu");
                  const state = p.state || p.toolInvocation?.state || "call";
                  const args =
                    p.args || p.toolInvocation?.args || p.input || {};
                  const approvalId =
                    p.approval?.id || p.toolInvocation?.approval?.id;

                  // === TRADUCTION VISUELLE DES OUTILS ===
                  // On crée des titres et descriptions "User Friendly"
                  const friendlyTitle = isSensitiveTool(toolName)
                    ? SENSITIVE_TOOL_LABELS[toolName]
                    : toolName;
                  let friendlyDetails = null;

                  if (toolName === "create-match-from-slot") {
                    friendlyDetails = (
                      <ul className="space-y-1.5 text-xs text-black/80">
                        <li>
                          <strong>Action :</strong> Créer une nouvelle session
                          de jeu.
                        </li>
                        {args.startTime && args.endTime && (
                          <li>
                            ⏰ <strong>Créneau :</strong> De{" "}
                            {new Date(args.startTime).toLocaleTimeString(
                              "fr-CH",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                            à{" "}
                            {new Date(args.endTime).toLocaleTimeString(
                              "fr-CH",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </li>
                        )}
                        {args.club && (
                          <li>
                            📍 <strong>Lieu :</strong> {args.club}
                          </li>
                        )}
                      </ul>
                    );
                  } else if (toolName === "join-open-match") {
                    friendlyDetails = (
                      <ul className="space-y-1.5 text-xs text-black/80">
                        <li>
                          <strong>Action :</strong> Rejoindre une partie
                          existante.
                        </li>
                        {args.matchId && (
                          <li className="font-mono bg-zinc-100 px-1 py-0.5 rounded w-fit">
                            🆔 Match ID : {args.matchId}
                          </li>
                        )}
                      </ul>
                    );
                  }

                  if (isSensitiveTool(toolName)) {
                    // 1. En chargement
                    if (state === "partial-call" || state === "call") {
                      return (
                        <div
                          key={i}
                          className="mt-3 text-xs text-zinc-500 flex items-center gap-2 font-medium"
                        >
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600"></span>
                          Préparation : {friendlyTitle}...
                        </div>
                      );
                    }

                    // 2. Demande de validation
                    if (state === "approval-requested") {
                      return (
                        <div
                          key={i}
                          className="mt-3 overflow-hidden rounded-lg border border-black/15 bg-white text-black shadow-sm"
                        >
                          {/* En-tête de la carte */}
                          <div className="bg-zinc-50 px-4 py-3 border-b border-black/5">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs">
                                ℹ️
                              </span>
                              Confirmation requise
                            </h4>
                            <p className="text-xs text-black/60 mt-1 ml-7">
                              L&apos;assistant souhaite effectuer l&apos;action
                              suivante pour toi.
                            </p>
                          </div>

                          {/* Corps avec les détails formatés (fini le JSON brut !) */}
                          <div className="px-4 py-3">
                            <div className="mb-4 rounded-md bg-blue-50/50 p-3 border border-blue-100/50">
                              <h5 className="font-medium text-sm text-blue-900 mb-2">
                                {friendlyTitle}
                              </h5>
                              {friendlyDetails}
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (approvalId) {
                                    addToolApprovalResponse({
                                      id: approvalId,
                                      approved: true,
                                    });
                                  }
                                }}
                                className="flex-1 bg-black text-white px-3 py-2 rounded-md text-xs font-semibold hover:bg-black/80 transition-colors"
                              >
                                Confirmer l&apos;action
                              </button>
                              <button
                                onClick={() => {
                                  if (approvalId) {
                                    addToolApprovalResponse({
                                      id: approvalId,
                                      approved: false,
                                    });
                                  }
                                }}
                                className="flex-1 bg-white border border-black/20 text-black px-3 py-2 rounded-md text-xs font-semibold hover:bg-zinc-50 transition-colors"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 3. Action réussie
                    if (state === "result" || state === "output-available") {
                      return (
                        <div
                          key={i}
                          className="mt-3 rounded-md bg-green-50 p-3 text-xs text-green-800 border border-green-200 flex items-start gap-2"
                        >
                          <span className="text-green-600 text-base leading-none">
                            ✓
                          </span>
                          <div>
                            <strong>{friendlyTitle}</strong>
                            <p className="opacity-80 mt-0.5">
                              L&apos;action a été accepté avec succès !
                            </p>
                          </div>
                        </div>
                      );
                    }

                    // 4. Action refusée ou échouée
                    if (state === "error" || state === "output-denied") {
                      return (
                        <div
                          key={i}
                          className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-800 border border-red-200 flex items-start gap-2"
                        >
                          <span className="text-red-600 text-base leading-none">
                            ✗
                          </span>
                          <div>
                            <strong>Action annulée</strong>
                            <p className="opacity-80 mt-0.5">
                              L&apos;action n&apos;a pas été effectuée.
                            </p>
                          </div>
                        </div>
                      );
                    }
                  }
                })}
              </div>
            );
          })}

          {showThinkingIndicator ? (
            <div className="w-fit max-w-[90%] rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-900">
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
      </main>

      <form onSubmit={onSubmit} className="mt-4 flex gap-2 flex-shrink-0">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Pose une question sur les terrains, slots ou matchs..."
          className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? "Envoi..." : "Envoyer"}
        </button>
      </form>

      {error ? (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
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
