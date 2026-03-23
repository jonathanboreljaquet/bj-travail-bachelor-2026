import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { seedClub } from "./seeds/club.seed";
import { seedCourt } from "./seeds/court.seed";
import { seedMatch } from "./seeds/match.seed";
import { seedUser } from "./seeds/user.seed";
import { seedParticipant } from "./seeds/participant.seed";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const VALID_CLUB_COURT_SLOTS = [
  { openingTime: "07:00", closingTime: "21:00", slot_duration: 60 },
  { openingTime: "07:00", closingTime: "22:00", slot_duration: 90 },
  { openingTime: "07:00", closingTime: "23:00", slot_duration: 120 },
  { openingTime: "08:00", closingTime: "21:00", slot_duration: 60 },
  { openingTime: "08:00", closingTime: "22:00", slot_duration: 120 },
  { openingTime: "08:00", closingTime: "23:00", slot_duration: 90 },
  { openingTime: "09:00", closingTime: "21:00", slot_duration: 90 },
  { openingTime: "09:00", closingTime: "22:00", slot_duration: 60 },
  { openingTime: "09:00", closingTime: "22:30", slot_duration: 90 },
  { openingTime: "09:00", closingTime: "23:00", slot_duration: 60 },
];

async function main() {
  await seedClub(prisma, VALID_CLUB_COURT_SLOTS);
  await seedCourt(prisma, VALID_CLUB_COURT_SLOTS);
  await seedUser(prisma);
  await seedMatch(prisma);
  await seedParticipant(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
