import {
    PrismaClient,
    CourtType,
    MatchStatus,
} from "../../generated/prisma/client";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

export async function seedDemo(prisma: PrismaClient) {
    console.log("--- Start seeding demo match ---");

    const thonexClub = await prisma.club.findFirst({
        where: { city: "Thonex" },
    });

    if (!thonexClub) {
        throw new Error(
            "Thônex club not found: seedClub must be executed before seedDemo.",
        );
    }

    const demoCourt = await prisma.court.create({
        data: {
            name: "Court Démo",
            type: CourtType.OUTDOOR,
            hasEquipmentBox: true,
            pricePerPerson: 18,
            slotDuration: 90,
            club_id: thonexClub.id,
        },
    });

    const passwordHash = await bcrypt.hash("pomme123", BCRYPT_ROUNDS);
    const opponent = await prisma.user.create({
        data: {
            firstname: "Alex",
            lastname: "Demo",
            email: "alex.demo@padelcontext.com",
            password: passwordHash,
            level: 3,
        },
    });

    const startTime = new Date();
    startTime.setUTCDate(startTime.getUTCDate() + 1);
    startTime.setUTCHours(16, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setUTCHours(17, 30, 0, 0);

    const demoMatch = await prisma.match.create({
        data: {
            startTime,
            endTime,
            status: MatchStatus.OPEN,
            availableSpots: 3,
            court_id: demoCourt.id,
            creator_id: opponent.id,
        },
    });

    await prisma.participant.create({
        data: { user_id: opponent.id, match_id: demoMatch.id },
    });

    console.log(
        `--- Finished seeding demo match (id=${demoMatch.id}) à Thônex ---`,
    );
}
