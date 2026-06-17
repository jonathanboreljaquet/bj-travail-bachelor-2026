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

export type Match = {
  id: number;
  startTime: string;
  endTime: string;
  status: string;
  availableSpots: number;
  court: Court;
  participants: Participant[];
};

export type AvailableSlot = {
  startTime: string;
  endTime: string;
};

export type AvailableSlotGroup = {
  court: Court & { id: number };
  availableSlots: AvailableSlot[];
};

export type MatchStatus = "OPEN" | "COMPLETED" | "CANCELED";

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
