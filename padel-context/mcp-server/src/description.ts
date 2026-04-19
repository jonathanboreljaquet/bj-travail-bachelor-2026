export const GET_OPEN_MATCHES_DESC = `Purpose:
Searches and lists available Padel matches to join based on filters.

When to use:
- Use this tool when a user wants to find or join an available Padel match.

When to not use:
- Do not use this tool when a user wants to create a match.

How to use:
- To filter specific matches: use the filters described in "Parameters".
- Date and timezone management: The user is located in the 'Europe/Zurich' timezone. You MUST dynamically account for Daylight Saving Time (CET/CEST) and convert all user time requests into UTC (ISO 8601 format ending with 'Z') BEFORE using the date parameters.

Limitations:
- Limit the number of returned matches to a maximum of 20, sorted by start time in ascending order (soonest first).
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