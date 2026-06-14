// Types partagés pour les données métier renvoyées par l'API (onglet "Matchs").

export type CourtType = "INDOOR" | "OUTDOOR" | "COVERED";

export type Club = {
  name: string;
  city: string;
  openingTime: string;
  closingTime: string;
};

export type Court = {
  name: string;
  type: CourtType;
  hasEquipmentBox: boolean;
  pricePerPerson: number;
  slotDuration: number;
  club: Club;
};

export type Participant = {
  user: {
    firstname: string;
    lastname: string;
    email: string;
    level: number;
  };
};

// Match ouvert renvoyé par GET /api/matches
export type Match = {
  id: number;
  startTime: string;
  endTime: string;
  status: string;
  availableSpots: number;
  court: Court;
  participants: Participant[];
};

// Créneau libre renvoyé par GET /api/available-slots (le court porte ici un id,
// nécessaire pour créer un match depuis le créneau).
export type AvailableSlot = {
  startTime: string;
  endTime: string;
};

export type AvailableSlotGroup = {
  court: Court & { id: number };
  availableSlots: AvailableSlot[];
};

// Statuts possibles d'un match côté API.
export type MatchStatus = "OPEN" | "COMPLETED" | "CANCELED";

// Match de l'utilisateur connecté renvoyé par GET /api/matches/me.
// Contrairement aux matchs ouverts, on récupère tous les statuts ainsi que
// l'identifiant du créateur. Les participants ne portent ici que le prénom et
// le niveau (cf. la sélection Prisma de l'endpoint).
export type MyMatchParticipant = {
  user: {
    firstname: string;
    level: number;
  };
};

export type MyMatch = {
  id: number;
  startTime: string;
  endTime: string;
  status: MatchStatus;
  availableSpots: number;
  creator_id: number;
  court: Court;
  participants: MyMatchParticipant[];
};
