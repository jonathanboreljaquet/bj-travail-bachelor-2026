"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart } from "ai";
import { logoutAction } from "@/app/actions/auth";
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

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
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

  const canSend = useMemo(
    () => input.trim().length > 0 && !isSending,
    [input, isSending],
  );

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
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
            const text = message.parts
              .filter(isTextUIPart)
              .map((part) => part.text)
              .join("\n")
              .trim();

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
                {message.role !== "user" ? (
                  <MarkdownMessage content={text || "..."} />
                ) : (
                  <p className="whitespace-pre-wrap">{text || ""}</p>
                )}
              </div>
            );
          })}
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
