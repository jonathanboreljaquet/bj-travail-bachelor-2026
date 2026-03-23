import { PrismaClient } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";

const USER_COUNT = 20;

export async function seedUser(prisma: PrismaClient) {
  console.log("--- Start seeding users ---");

  let count = 0;
  for (let i = 0; i < USER_COUNT; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    const user = await prisma.user.create({
      data: {
        firstname: firstName,
        lastname: lastName,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        password: faker.internet.password({ length: 12 }),
        level: faker.number.int({ min: 1, max: 10 }),
      },
    });
    count++;
  }

  console.log("--- Finished seeding users ---");
}
