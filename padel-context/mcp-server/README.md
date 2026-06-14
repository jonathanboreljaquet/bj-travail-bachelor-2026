# MCP Server

Serveur **Model Context Protocol** de l'application Padel Context. Il expose les
fonctionnalités de l'API REST sous forme d'outils (tools) consommables par un
client IA, en relayant le JWT de l'utilisateur.

## Stack technique

- Node.js + Express (TypeScript)
- SDK Model Context Protocol (`@modelcontextprotocol/*`)
- `dayjs` (dates) · `yaml` · `express-rate-limit`
- Exécution : `tsx`

## Arborescence du projet

```text
mcp-server/
├── src/                          # Code source du serveur MCP
│   ├── server.ts                 # Point d'entrée (HTTP + enregistrement des tools)
│   ├── tools/                    # Outils MCP exposés au client
│   │   ├── getOpenMatches.ts     # Rechercher les matchs ouverts
│   │   ├── getAvailableSlots.ts  # Rechercher les créneaux libres
│   │   ├── joinOpenMatch.ts      # Rejoindre un match ouvert
│   │   └── createMatchFromSlot.ts # Créer un match depuis un créneau
│   └── utils/                    # Fonctions utilitaires partagées
│       └── utils.ts
├── Dockerfile                    # Image Docker du serveur MCP
├── package.json                  # Dépendances et scripts
├── tsconfig.json                 # Configuration TypeScript
├── eslint.config.mjs             # Règles de lint
├── .prettierrc                   # Configuration de formatage
└── README.md                     # Documentation du dossier mcp-server
```

## Configuration et lancement avec Docker

Le lancement complet (tous les services) et les variables d'environnement sont
décrits dans le [README principal](../README.md#variables-denvironnement).

## Inspection

### Lancer l'inspecteur MCP pour tester manuellement

```bash
npx @modelcontextprotocol/inspector
```

> [!TIP]
> Il est important de spécifier un en-tête HTTP personnalisé (**Custom Header**) avec :
>
> - **Clé** : `Authorization`
> - **Valeur** : `Bearer [JWT valide]`
>
> Le JWT peut être obtenu en effectuant une requête `POST` sur l'endpoint `http://localhost:3000/api/login` (par exemple via Postman), puis en récupérant le token retourné dans la réponse.
>
> Sans cet en-tête, les endpoints protégés retourneront une erreur d'authentification.
