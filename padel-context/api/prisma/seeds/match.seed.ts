import { PrismaClient, matchStatus } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";

const DAYS_TO_GENERATE = 7;
const MATCHES_PER_COURT_PER_DAY = 4;

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function getAllSlots(
  openingTime: string,
  closingTime: string,
  slotDurationMin: number,
): number[] {
  const slots: number[] = [];
  const openMinutes = timeToMinutes(openingTime);
  const closeMinutes = timeToMinutes(closingTime);

  let current = openMinutes;
  while (current + slotDurationMin <= closeMinutes) {
    slots.push(current);
    current += slotDurationMin;
  }
  return slots;
}

export async function seedMatch(prisma: PrismaClient) {
  console.log("--- Start seeding matches ---");

  const courts = await prisma.court.findMany({ include: { club: true } });
  const users = await prisma.user.findMany();

  if (users.length === 0) {
    console.warn("No users found, skipping match seeding");
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const court of courts) {
    const allSlots = getAllSlots(
      court.club.openingTime,
      court.club.closingTime,
      court.slotDuration,
    );

    for (let day = 0; day < DAYS_TO_GENERATE; day++) {
      const selectedSlots = faker.helpers.arrayElements(
        allSlots,
        MATCHES_PER_COURT_PER_DAY,
      );
      const matchConfigs = [
        { status: matchStatus.COMPLETED, availableSpots: 0 },
        { status: matchStatus.COMPLETED, availableSpots: 0 },
        {
          status: matchStatus.CANCELED,
          availableSpots: faker.number.int({ min: 1, max: 3 }),
        },
        {
          status: matchStatus.OPEN,
          availableSpots: faker.number.int({ min: 1, max: 3 }),
        },
      ];

      for (let i = 0; i < selectedSlots.length; i++) {
        const slotMinutes = selectedSlots[i];
        const config = matchConfigs[i];

        const startTime = new Date(today);
        startTime.setDate(startTime.getDate() + day);
        startTime.setHours(
          Math.floor(slotMinutes / 60),
          slotMinutes % 60,
          0,
          0,
        );

        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + court.slotDuration);

        await prisma.match.create({
          data: {
            startTime,
            endTime,
            status: config.status,
            availableSpots: config.availableSpots,
            court_id: court.id,
            creator_id: faker.helpers.arrayElement(users).id,
          },
        });
      }
    }
  }

  console.log("--- Finished seeding matches ---");
}
