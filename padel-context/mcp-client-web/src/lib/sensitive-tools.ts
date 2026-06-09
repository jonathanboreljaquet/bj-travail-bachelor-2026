export type SensitiveToolName = "create-match-from-slot" | "join-open-match";

export const SENSITIVE_TOOL_NAMES: readonly SensitiveToolName[] = [
  "create-match-from-slot",
  "join-open-match",
];

export function isSensitiveTool(name: string): name is SensitiveToolName {
  return (SENSITIVE_TOOL_NAMES as readonly string[]).includes(name);
}

export const SENSITIVE_TOOL_LABELS: Record<SensitiveToolName, string> = {
  "create-match-from-slot": "🎾 Création de match",
  "join-open-match": "🤝 Inscription à un match",
};
