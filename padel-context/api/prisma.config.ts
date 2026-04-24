import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DATABASE_USER || "padel-context-db_user"}:${process.env.DATABASE_PASSWORD || "padel-context-db_password"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.DATABASE_HOST_PORT || "5433"}/${process.env.DATABASE_NAME || "padel-context-db"}?schema=public`;

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
        seed: "tsx prisma/seed.ts",
    },
    datasource: {
        url: databaseUrl,
    },
});
