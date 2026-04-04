import { PrismaClient } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";

const USER_COUNT = 20;
const BCRYPT_ROUNDS = 10;

export async function seedUser(prisma: PrismaClient) {
  console.log("--- Start seeding users ---");

  let count = 0;
  for (let i = 0; i < USER_COUNT; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    const hashedPassword = await bcrypt.hash(
      faker.internet.password({ length: 12 }),
      BCRYPT_ROUNDS,
    );

    const user = await prisma.user.create({
      data: {
        firstname: firstName,
        lastname: lastName,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        password: hashedPassword,
        level: faker.number.int({ min: 1, max: 10 }),
      },
    });
    count++;
  }

  const passwordHash = await bcrypt.hash(
    "pomme123",
    BCRYPT_ROUNDS,
  );

  await prisma.user.create({
    data: {
      firstname: "Jonathan",
      lastname: "Borel-Jaquet",
      email: "jonathan.borel@padelcontext.com",
      password: passwordHash,
      level: 3,
    },
  });

  console.log("--- Finished seeding users ---");
}
