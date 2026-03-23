import { PrismaClient, matchStatus } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";

export async function seedParticipant(prisma: PrismaClient) {
  console.log("--- Start seeding participants ---");

  const matches = await prisma.match.findMany();
  const users = await prisma.user.findMany();

  for (const match of matches) {
    const participantCount = 4 - match.availableSpots;

    if (participantCount <= 0) continue;
    const otherUsers = users.filter((u) => u.id !== match.creator_id);
    const randomParticipants = faker.helpers.arrayElements(
      otherUsers,
      participantCount - 1,
    );

    await prisma.participant.create({
      data: { user_id: match.creator_id, match_id: match.id },
    });

    for (const user of randomParticipants) {
      await prisma.participant.create({
        data: { user_id: user.id, match_id: match.id },
      });
    }
  }

  console.log("--- Finished seeding participants ---");
}
