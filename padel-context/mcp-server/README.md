# MCP Server

Serveur Model Context Protocol pour l'application padel-context.

## Arborescence du projet

Le dossier `mcp-server/` est organisé de la manière suivante :

```text
mcp-server/
├── src/                    # Code source principal du serveur MCP
│   ├── server.ts           # Point d'entrée du serveur MCP
│   ├── tools/              # Outils MCP exposés au client
│   │   ├── createMatchFromSlot.ts
│   │   ├── getAvailableSlots.ts
│   │   ├── getOpenMatches.ts
│   │   └── joinOpenMatch.ts
│   └── utils/              # Fonctions utilitaires partagées
│       └── utils.ts
├── Dockerfile              # Image Docker du serveur MCP
├── package.json            # Dépendances et scripts du serveur MCP
├── tsconfig.json           # Configuration TypeScript
├── eslint.config.mjs       # Règles de lint
├── .prettierrc             # Configuration de formatage
├── .gitignore              # Fichiers ignorés par Git
└── README.md               # Documentation du dossier mcp-server
```

## Configuration et lancement avec Docker

Voir [README principal](../README.md)

## Développement local

```bash
npm install
npm run dev     # démarrage avec watcher
npm start       # démarrage simple
```

## Inspection

# Lancer l'inspecteur MCP pour tester manuellement

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
