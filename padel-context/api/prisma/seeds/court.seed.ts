import { PrismaClient, CourtType } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";

export async function seedCourt(
  prisma: PrismaClient,
  valid_club_courts_slots: {
    openingTime: string;
    closingTime: string;
    slot_duration: number;
  }[],
) {
  console.log("-- Start seeding courts ---");

  const clubs = await prisma.club.findMany();
  let count = 0;

  for (const club of clubs) {
    for (let i = 1; i <= 2; i++) {
      const court = await prisma.court.create({
        data: {
          name: `Court ${i}`,
          type: faker.helpers.arrayElement(Object.values(CourtType)),
          hasEquipmentBox: faker.datatype.boolean(),
          pricePerPerson: faker.number.float({
            min: 10,
            max: 20,
            multipleOf: 5,
          }),
          slotDuration: valid_club_courts_slots[count].slot_duration,
          club_id: club.id,
        },
      });
    }
    count++;
  }

  console.log("-- Finished seeding courts ---");
}
