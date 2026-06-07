import { PrismaClient } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";

// Liste de villes et codes postaux dans le canton de Genève pour générer des clubs réalistes.
const GENEVA_CITIES = [
    { city: "Servette", postalCode: "1203" },
    { city: "Carouge", postalCode: "1227" },
    { city: "Grand-Lancy", postalCode: "1212" },
    { city: "Meyrin", postalCode: "1217" },
    { city: "Vernier", postalCode: "1214" },
    { city: "Onex", postalCode: "1213" },
    { city: "Thonex", postalCode: "1226" },
    { city: "Versoix", postalCode: "1290" },
    { city: "Chene-Bougeries", postalCode: "1224" },
    { city: "Plan-les-Ouates", postalCode: "1228" },
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
    for (const { city, postalCode } of GENEVA_CITIES) {
        const schedule = valid_club_courts_slots[count];
        await prisma.club.create({
            data: {
                name: `${faker.company.name()} Padel Club`,
                city,
                postalCode,
                openingTime: schedule.openingTime,
                closingTime: schedule.closingTime,
            },
        });
        count++;
    }
    console.log("--- Finished seeding clubs ---");
}
