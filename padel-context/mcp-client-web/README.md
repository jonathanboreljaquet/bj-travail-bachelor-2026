# MCP Client Web

Client web de l'application Padel Context : une interface Next.js avec un
assistant IA (chatbot) connecté au serveur MCP, ainsi qu'une navigation
« classique » pour rechercher, créer et rejoindre des matchs.

## Stack technique

- Next.js 16 (App Router) + React 19 (TypeScript)
- Vercel AI SDK v6 (`ai`, `@ai-sdk/react`) + Google Gemini (`@ai-sdk/google`)
- Client MCP (`@ai-sdk/mcp`, `@modelcontextprotocol/sdk`)
- Tailwind CSS 4
- Rate limiting (`@upstash/ratelimit` / `@upstash/redis`)
- Observabilité (`@langfuse/*`, OpenTelemetry)

## Arborescence du projet

```text
mcp-client-web/
├── src/
│   ├── app/                          # App Router Next.js
│   │   ├── layout.tsx                # Layout racine
│   │   ├── page.tsx                  # Accueil (redirige vers /chatbot si connecté)
│   │   ├── globals.css               # Styles globaux (Tailwind)
│   │   ├── login/                    # Page de connexion
│   │   │   └── page.tsx
│   │   ├── (app)/                    # Espace authentifié (groupe de routes)
│   │   │   ├── layout.tsx            # Garde d'authentification + en-tête
│   │   │   ├── chatbot/              # Assistant IA (chat MCP)
│   │   │   ├── matches/              # Recherche de matchs / créneaux libres
│   │   │   └── my-matches/           # Matchs de l'utilisateur connecté
│   │   ├── actions/                  # Server Actions (écritures)
│   │   │   ├── auth.ts               # Connexion / déconnexion
│   │   │   └── matches.ts            # Rejoindre / créer un match
│   │   └── api/                      # Route Handlers
│   │       ├── chat/route.ts         # Endpoint du chatbot (Gemini + MCP)
│   │       └── usage/route.ts        # Consommation de tokens
│   ├── components/                   # Composants UI réutilisables
│   ├── lib/                          # Utilitaires partagés
│   │   ├── api.ts                    # Lectures de l'API (côté serveur)
│   │   ├── config.ts                 # URLs internes (API, serveur MCP)
│   │   ├── types.ts                  # Types métier
│   │   ├── format.ts                 # Formatage (dates, libellés)
│   │   ├── ratelimit.ts              # Rate limiting (Upstash Redis)
│   │   ├── request-identifier.ts     # Identifiant pour le rate limiting
│   │   └── sensitive-tools.ts        # Outils MCP nécessitant une validation (HITL)
│   ├── instrumentation.ts            # Hook d'instrumentation Next.js
│   └── instrumentation.node.ts       # Tracing Langfuse (OpenTelemetry)
├── Dockerfile                        # Image Docker du client web
├── next.config.ts                    # Configuration Next.js
├── package.json                      # Dépendances et scripts
├── tsconfig.json                     # Configuration TypeScript
├── postcss.config.mjs                # Configuration PostCSS (Tailwind)
├── eslint.config.mjs                 # Règles de lint
└── README.md                         # Documentation du dossier mcp-client-web
```

## Configuration et lancement avec Docker

Le lancement complet (tous les services) et les variables d'environnement sont
décrits dans le [README principal](../README.md#variables-denvironnement).
