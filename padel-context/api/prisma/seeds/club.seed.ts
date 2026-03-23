import { PrismaClient } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";

const GENEVA_CITIES = [
  "Genève",
  "Carouge",
  "Lancy",
  "Meyrin",
  "Vernier",
  "Onex",
  "Thônex",
  "Versoix",
  "Chêne-Bougeries",
  "Plan-les-Ouates",
];

export async function seedClub(
  prisma: PrismaClient,
  valid_club_courts_slots: {
    openingTime: string;
    closingTime: string;
    slot_duration: number;
  }[],
) {
  console.log("--- Start seeding clubs ---");

  let count = 0;
  for (const city of GENEVA_CITIES) {
    const schedule = valid_club_courts_slots[count];
    const club = await prisma.club.create({
      data: {
        name: `${faker.company.name()} Padel Club`,
        city,
        openingTime: schedule.openingTime,
        closingTime: schedule.closingTime,
      },
    });
    count++;
  }
  console.log("--- Finished seeding clubs ---");
}
