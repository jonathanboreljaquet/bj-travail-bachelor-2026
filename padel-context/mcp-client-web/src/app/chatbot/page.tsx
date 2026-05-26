"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart } from "ai";
import { logoutAction } from "@/app/actions/auth";

export default function Home() {
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

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
  }

  async function handleLogout() {
    await logoutAction();
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center justify-between border-b border-black/10 pb-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Padel Context - MVP MCP Client
          </h1>
          <p className="mt-1 text-sm text-black/60">
            Assistant IA connecté au serveur MCP.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
        >
          Déconnexion
        </button>
      </header>

      <main className="flex-1 space-y-3 overflow-y-auto rounded-md border border-black/10 bg-white p-4">
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
              <p className="whitespace-pre-wrap">
                {text || (message.role === "assistant" ? "..." : "")}
              </p>
            </div>
          );
        })}
      </main>

      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
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
