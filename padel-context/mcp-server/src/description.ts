export const GET_OPEN_MATCHES_DESC = `Purpose:
Searches and lists available Padel matches to join based on filters.

When to use:
- Use this tool when a user wants to find or join an available Padel match.

When to not use:
- Do not use this tool when a user wants to create a Padel match.

How to use:
- To filter specific matches: use the filters described in "Parameters".
- The user is located in the 'Europe/Zurich' timezone. You MUST dynamically account for Daylight Saving Time (CET/CEST) and convert all user time requests into UTC (ISO 8601 format ending with 'Z') BEFORE using the date parameters.
- Before presenting times to the user, you MUST convert every datetime to Europe/Zurich local time (CET/CEST).

Limitations:
- You MUST provide at least two filters.
- At least one filter MUST be temporal (startTimeTo + startTimeFrom or endTimeTo + endTimeFrom).
- At least one filter MUST be contextual (city, courtType, hasEquipmentBox, price range, slot duration, available spots, or participant level).
- The requested time range MUST be less than or equal to 7 days.
- The 'participantAverageLevelTolerance' parameter has no effect if 'participantAverageLevel' is not provided.

Parameters:
- city (string, optional): Target city. If requested, the tool filters matches to return only those at courts in clubs located in this city.
- courtType (string, optional): Target court type. If requested, the tool filters matches to return only those on courts of this type. Strict allowed values: "INDOOR", "OUTDOOR", "COVERED".
- hasEquipmentBox (boolean, optional): If requested, the tool filters matches to return only those on courts that provide an equipment rental box (hasEquipmentBox = true).
- minPricePerPerson (number, optional): If requested, the tool filters matches to return only those on courts with a price equal to or greater than this value.
- maxPricePerPerson (number, optional): If requested, the tool filters matches to return only those on courts with a price equal to or lower than this value.
- slotDuration (integer, optional): If requested, the tool filters matches to return only those on courts with a duration exactly equal to this value in minutes.
- availableSpots (integer, optional): If requested, the tool filters matches to return only those with a number of available spots exactly equal to this value.
- minAvailableSpots (integer, optional): If requested, the tool filters matches to return only those with a number of available spots equal to or greater than this value. Essential if the user wants to register a group. For example, if a user says "I want to play with a friend", you MUST use 'minAvailableSpots: 2'.
- startTimeFrom (iso datetime, optional): If requested, the tool filters matches to return only those starting after this date/time.
- startTimeTo (iso datetime, optional): If requested, the tool filters matches to return only those starting before this date/time.
- endTimeFrom (iso datetime, optional): If requested, the tool filters matches to return only those ending after this date/time.
- endTimeTo (iso datetime, optional): If requested, the tool filters matches to return only those ending before this date/time.
- participantAverageLevel (number, optional): If requested, the tool filters matches to return only those where the average participant level equals this value.
- participantAverageLevelTolerance (number, optional): If requested, the tool filters matches to return only those where the average participant level falls within this margin. For example, with a 'participantAverageLevel' of 5 and a 'participantAverageLevelTolerance' of 0.5, the tool will return matches from level 4.5 to 5.5.`;

export const GET_AVAILABLE_SLOTS_DESC = `Purpose:
Searches and lists available Padel time slots by court based on filters.

When to use:
- Use this tool when a user wants to find an open slot or create a Padel match.

When to not use:
- Do not use this tool when a user wants to find or join an available Padel match.

How to use:
- To filter specific slots: use the filters described in "Parameters".
- The user is located in the 'Europe/Zurich' timezone. You MUST dynamically account for Daylight Saving Time (CET/CEST) and convert all user time requests into UTC (ISO 8601 format ending with 'Z') BEFORE using the date parameters.
- Before presenting times to the user, you MUST convert every datetime to Europe/Zurich local time (CET/CEST).

Limitations:
- You MUST provide at least two filters.
- At least one filter MUST be temporal (timeTo + timeFrom).
- At least one filter MUST be contextual (city, courtType, hasEquipmentBox, price range, or slot duration).
- timeTo MUST be strictly greater than timeFrom.
- The requested time range MUST be less than or equal to 7 days.

Parameters:
- city (string, optional): Target city. If requested, the tool filters courts to clubs located in this city.
- courtType (string, optional): Target court type. Strict allowed values: "INDOOR", "OUTDOOR", "COVERED".
- hasEquipmentBox (boolean, optional): If requested, the tool filters courts based on equipment rental box availability.
- minPricePerPerson (number, optional): If requested, the tool filters courts with pricePerPerson greater than or equal to this value.
- maxPricePerPerson (number, optional): If requested, the tool filters courts with pricePerPerson lower than or equal to this value.
- slotDuration (integer, optional): If requested, the tool filters courts with slotDuration exactly equal to this value in minutes.
- minSlotDuration (integer, optional): If requested, the tool filters courts with slotDuration greater than or equal to this value in minutes.
- maxSlotDuration (integer, optional): If requested, the tool filters courts with slotDuration lower than or equal to this value in minutes.
- timeFrom (iso datetime, optional): Start of the requested availability window. The tool returns only slots that start/end within the requested window constraints.
- timeTo (iso datetime, optional): End of the requested availability window. Must be strictly greater than timeFrom when both are provided.`;

export const JOIN_OPEN_MATCH_DESC = `Purpose:
Joins an existing open Padel match.

When to use:
- Use this tool when the user confirms they want to join a specific Padel match.

When to not use:
- Do not use this tool to create a new match.

How to use:
- Use the match id for join a match.
- Use the JWT token for authentication.

Limitations:
- Requires a valid JWT token.
- Will fail if the match is not open, has no available spots, or user already joined.

Parameters:
- matchId (integer, required): ID of the match to join.
- jwtToken (string, required): Bearer JWT token. JWT token of the user.`;

export const CREATE_MATCH_FROM_SLOT_DESC = `Purpose:
Creates a new Padel match from an available time slot.

When to use:
- Use this tool when the user confirms they want to create a specific new match from an available slot.

When to not use:
- Do not use this tool to join an existing match.

How to use:
- Pass the exact courtId, startTime, and endTime of that slot.
- The user is located in the 'Europe/Zurich' timezone. You MUST dynamically account for Daylight Saving Time (CET/CEST) and convert all user time requests into UTC (ISO 8601 format ending with 'Z') BEFORE using the date parameters.
- Use the JWT token for authentication.

Limitations:
- Requires a valid JWT token.
- Will fail if the slot is already occupied or no longer available.

Parameters:
- courtId (integer, required): ID of the court for the slot.
- startTime (iso datetime, required): UTC start of the slot.
- endTime (iso datetime, required): UTC end of the slot.
- jwtToken (string, required): Bearer JWT token. JWT token of the user.`;