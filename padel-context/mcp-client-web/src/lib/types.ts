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
