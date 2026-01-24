/**
 * Visinet Report Parser
 *
 * Extracts structured data from Visinet CAD (Computer-Aided Dispatch) reports.
 * These reports contain valuable incident metadata including:
 * - Incident identification and timing
 * - Location details with coordinates
 * - Unit response times (assigned, enroute, arrived)
 * - Personnel assignments
 * - CAD narrative comments
 * - Custom timestamps (search complete, fire under control, etc.)
 */

/**
 * Parsed incident header information
 */
export interface VisinetIncidentHeader {
  incidentNumber: string;
  incidentDate: Date | null;
  reportGenerated: Date | null;
  incidentStatus: string;
  caseNumbers?: string;
}

/**
 * Incident type and classification
 */
export interface VisinetIncidentInfo {
  incidentType: string;
  alarmLevel: string;
  priority: string;
  problem: string;
  determinant?: string;
  agency: string;
  jurisdiction: string;
  division: string;
  battalion: string;
  responseArea: string;
  responsePlan: string;
  disposition?: string;
  primaryTAC: string;
  secondaryTAC?: string;
  certification?: string;
}

/**
 * Incident location details
 */
export interface VisinetLocation {
  locationName?: string;
  address: string;
  apartment?: string;
  building?: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  crossStreet?: string;
  mapReference?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Key incident timestamps
 */
export interface VisinetTimeStamps {
  phonePickup: Date | null;
  firstKeyStroke?: Date | null;
  inWaitingQueue?: Date | null;
  callTakingComplete?: Date | null;
  firstUnitAssigned: Date | null;
  firstUnitEnroute: Date | null;
  firstUnitArrived: Date | null;
  closed?: Date | null;
}

/**
 * Calculated elapsed times
 */
export interface VisinetElapsedTimes {
  receivedToInQueue?: string;
  callTaking?: string;
  inQueueToFirstAssign?: string;
  callReceivedToFirstAssign?: string;
  assignedToFirstEnroute?: string;
  enrouteToFirstArrived?: string;
  incidentDuration?: string;
}

/**
 * Individual unit response record
 */
export interface VisinetUnitResponse {
  unit: string;
  isPrimary: boolean;
  assigned: string | null;
  disposition?: string;
  enroute: string | null;
  staged?: string | null;
  arrived: string | null;
  atPatient?: string | null;
  delay?: string | null;
  available?: string | null;
  complete?: string | null;
}

/**
 * Personnel assigned to a unit
 */
export interface VisinetPersonnel {
  unit: string;
  personnel: string[];
}

/**
 * CAD comment/narrative entry
 */
export interface VisinetComment {
  date: string;
  time: string;
  user: string;
  type: string;
  comment: string;
}

/**
 * Custom timestamp entry (search complete, fire under control, etc.)
 */
export interface VisinetCustomTimeStamp {
  description: string;
  date: string;
  time: string;
  user?: string;
}

/**
 * Complete parsed Visinet report
 */
export interface VisinetReport {
  header: VisinetIncidentHeader;
  incidentInfo: VisinetIncidentInfo;
  location: VisinetLocation;
  timeStamps: VisinetTimeStamps;
  elapsedTimes: VisinetElapsedTimes;
  unitsAssigned: VisinetUnitResponse[];
  personnel: VisinetPersonnel[];
  comments: VisinetComment[];
  customTimeStamps: VisinetCustomTimeStamp[];
  rawText: string;
  parseWarnings: string[];
}

/**
 * Check if text appears to be a Visinet report
 */
export function isVisinetReport(text: string): boolean {
  const indicators = [
    "Incident Detail Report",
    "Data Source: Data Warehouse",
    "Visinet",
    "Resources Assigned",
    "Personnel Assigned",
  ];

  const lowerText = text.toLowerCase();
  const matchCount = indicators.filter((ind) =>
    lowerText.includes(ind.toLowerCase()),
  ).length;

  // Need at least 2 indicators to be confident
  return matchCount >= 2;
}

/**
 * Parse a date/time string from Visinet format
 * Format: "MM/DD/YYYY HH:MM:SS" or "MM/DD/YYYY"
 */
function parseVisinetDateTime(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "") return null;

  // Handle "MM/DD/YYYY HH:MM:SS" format
  const fullMatch = dateStr.match(
    /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/,
  );
  if (fullMatch) {
    const [, month, day, year, hour, minute, second] = fullMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second),
    );
  }

  // Handle "MM/DD/YYYY" format
  const dateOnlyMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateOnlyMatch) {
    const [, month, day, year] = dateOnlyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  return null;
}

/**
 * Extract a field value from text using a label pattern
 * Handles both line-separated and continuous text formats
 */
function extractField(text: string, label: string): string | null {
  // Common field labels that might follow this one
  const nextFieldLabels = [
    "Incident number",
    "Incident Date",
    "Report Generated",
    "Incident Status",
    "Case Numbers",
    "Incident Type",
    "Alarm Level",
    "Priority",
    "Problem",
    "Determinant",
    "Agency",
    "Base Response",
    "Jurisdiction",
    "Confirmation",
    "Division",
    "Taken By",
    "Battalion",
    "Response Area",
    "Response Plan",
    "Disposition",
    "Command Ch",
    "Cancel Reason",
    "Primary TAC",
    "Secondary TAC",
    "Certification",
    "Delay Reason",
    "Location Name",
    "Location Type",
    "Address",
    "Apartment",
    "Building",
    "City, State, Zip",
    "City State Zip",
    "County",
    "Cross Street",
    "Map Reference",
    "Latitude",
    "Longitude",
    "Call Receipt",
    "Caller Name",
    "Method Received",
    "Call Back Phone",
    "Caller Type",
    "Caller Location",
    "Caller Address",
    "Caller Building",
    "Caller Apartment",
    "Caller City",
    "Caller County",
    "Phone Pickup",
    "1st Key Stroke",
    "In Waiting Queue",
    "Call Taking Complete",
    "1st Unit Assigned",
    "1st Unit Enroute",
    "1st Unit Arrived",
    "Closed",
    "Received to In Queue",
    "Call Taking",
    "In Queue to 1st Assign",
    "Call Received to 1st Assign",
    "Assigned to 1st Enroute",
    "Enroute to 1st Arrived",
    "Incident Duration",
    "Time Stamps",
    "Elapsed Times",
    "Description",
    "Resources Assigned",
    "Personnel Assigned",
    "Caution Notes",
    "Comments",
  ];

  // Build a pattern that captures until the next known field or newline
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // First try with colon separator
  let pattern = new RegExp(
    `${escapedLabel}:\\s*([^\\n]+?)(?=\\s+(?:${nextFieldLabels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})[:\\s]|$)`,
    "i",
  );
  let match = text.match(pattern);
  if (match && match[1] && match[1].trim()) {
    return match[1].trim();
  }

  // Try without colon - capture until next label
  pattern = new RegExp(
    `${escapedLabel}\\s+([^\\n]+?)(?=\\s+(?:${nextFieldLabels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})[:\\s]|$)`,
    "i",
  );
  match = text.match(pattern);
  if (match && match[1] && match[1].trim()) {
    return match[1].trim();
  }

  // Fallback: just capture a reasonable length value (up to next space + capital word pattern)
  pattern = new RegExp(
    `${escapedLabel}[:\\s]+([\\w\\d\\s,.-]{1,100}?)(?=\\s+[A-Z][a-z]+[:\\s]|$)`,
    "i",
  );
  match = text.match(pattern);
  if (match && match[1] && match[1].trim()) {
    return match[1].trim();
  }

  return null;
}

/**
 * Extract coordinate from Visinet format (stored as integers, needs decimal)
 */
function parseCoordinate(
  value: string | null,
  isLongitude = false,
): number | undefined {
  if (!value) return undefined;
  const num = parseInt(value, 10);
  if (isNaN(num)) return undefined;

  // Visinet stores as integer without decimal (e.g., 30302361 for 30.302361)
  // Longitude is negative for US west of prime meridian
  const decimal = num / 1000000;
  return isLongitude ? -Math.abs(decimal) : decimal;
}

/**
 * Parse the Resources Assigned table
 * Handles both line-separated and continuous text formats from PDF extraction
 */
function parseUnitsAssigned(text: string): VisinetUnitResponse[] {
  const units: VisinetUnitResponse[] = [];

  // Find the Resources Assigned section
  const resourcesMatch = text.match(
    /Resources Assigned[\s\S]*?(?=Personnel Assigned|Caution Notes|$)/i,
  );
  if (!resourcesMatch) return units;

  const section = resourcesMatch[0];

  // First try line-by-line parsing
  const lines = section.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    // Match unit patterns like "ENG14 Y 06:55:36..."
    const unitMatch = line.match(/^([A-Z]+\d+)\s+(Y|N)\s+(\d{2}:\d{2}:\d{2})/);
    if (unitMatch) {
      const [, unit, primaryFlag, assigned] = unitMatch;
      const times = line.match(/\d{2}:\d{2}:\d{2}/g) || [];

      units.push({
        unit,
        isPrimary: primaryFlag === "Y",
        assigned,
        enroute: times[1] || null,
        arrived: times[2] || null,
        complete:
          times[times.length - 1] !== assigned ? times[times.length - 1] : null,
      });
    }
  }

  // If no units found with line parsing, try continuous text parsing
  // This handles PDF extraction which often produces single-line text
  if (units.length === 0) {
    // Match unit entries in continuous text
    // Pattern: Unit name (letters + optional digits) followed by Y/N and times
    // Unit names: ENG14, RES14, BAT06, FTAC201, LAD18, TK03, INV07, SAFE01, FTO01, etc.
    const unitPattern =
      /\b([A-Z]{2,}(?:\d+)?)\s+(Y|N)\s+(\d{2}:\d{2}:\d{2})(?:\s+(?:Fire[^0-9]*|SrvOth[^0-9]*|[A-Za-z\s\-]*?))?(\d{2}:\d{2}:\d{2})?(?:\s+)?(\d{2}:\d{2}:\d{2})?(?:\s+)?(\d{2}:\d{2}:\d{2})?/g;

    let match;
    while ((match = unitPattern.exec(section)) !== null) {
      const [fullMatch, unit, primaryFlag, assigned, time2, time3, time4] =
        match;

      // Skip header row matches
      if (
        unit === "Unit" ||
        unit === "Odm" ||
        unit === "Cancel" ||
        unit === "Reason"
      ) {
        continue;
      }

      // Skip if this looks like part of the header
      if (fullMatch.includes("Primary Flag") || fullMatch.includes("Staged")) {
        continue;
      }

      // Collect all times from this match
      const times = [assigned, time2, time3, time4].filter(Boolean);

      units.push({
        unit,
        isPrimary: primaryFlag === "Y",
        assigned,
        enroute: times[1] || null,
        arrived: times[2] || null,
        complete: times[3] || null,
      });
    }
  }

  return units;
}

/**
 * Parse the Personnel Assigned section
 * Handles both line-separated and continuous text formats from PDF extraction
 */
function parsePersonnel(text: string): VisinetPersonnel[] {
  const personnel: VisinetPersonnel[] = [];

  // Find the Personnel Assigned section
  const personnelMatch = text.match(
    /Personnel Assigned[\s\S]*?(?=Caution Notes|Pre-Scheduled|Comments|$)/i,
  );
  if (!personnelMatch) return personnel;

  const section = personnelMatch[0];

  // First try line-by-line parsing
  const lines = section.split("\n").filter((l) => l.trim());

  let currentUnit: string | null = null;
  let currentNames: string[] = [];

  for (const line of lines) {
    // Match unit line: "ENG14 BROWNLEE, JACOB W (FD002618)..."
    const unitMatch = line.match(/^([A-Z]+\d+)\s+(.+)/);
    if (unitMatch) {
      // Save previous unit if exists
      if (currentUnit && currentNames.length > 0) {
        personnel.push({ unit: currentUnit, personnel: currentNames });
      }

      currentUnit = unitMatch[1];
      const namesStr = unitMatch[2];
      currentNames = extractPersonnelNames(namesStr);
    } else if (currentUnit && line.trim()) {
      // Continuation line for current unit
      currentNames.push(...extractPersonnelNames(line));
    }
  }

  // Don't forget the last unit from line parsing
  if (currentUnit && currentNames.length > 0) {
    personnel.push({ unit: currentUnit, personnel: currentNames });
  }

  // If no personnel found with line parsing, try continuous text parsing
  if (personnel.length === 0) {
    // In continuous text, the pattern is:
    // UNIT1 NAME1 (ID) - AFD - Active; NAME2 (ID) - AFD - Active UNIT2 NAME3 (ID)...
    // We need to find unit names followed by their personnel

    // Get all unit names we found in resources assigned section
    const knownUnits = new Set<string>();
    const unitNamesMatch = text.match(/Resources Assigned[\s\S]*?Personnel/i);
    if (unitNamesMatch) {
      const unitMatches = unitNamesMatch[0].matchAll(
        /\b([A-Z]{2,}(?:\d+)?)\s+[YN]\s+\d{2}:\d{2}/g,
      );
      for (const m of unitMatches) {
        if (
          m[1] !== "Unit" &&
          m[1] !== "Odm" &&
          m[1] !== "Cancel" &&
          m[1] !== "Reason"
        ) {
          knownUnits.add(m[1]);
        }
      }
    }

    // Also match common unit prefixes in personnel section directly
    const unitPrefixes =
      /\b(ENG|RES|LAD|TK|BAT|SAFE|INV|FTO|FTAC|BC|DC|SQUAD|MEDIC|AMB|CHIEF)\d+\b/g;

    // Find all unit occurrences in the personnel section
    const unitPositions: { unit: string; pos: number }[] = [];
    let unitMatch;
    while ((unitMatch = unitPrefixes.exec(section)) !== null) {
      // Only skip if this is literally the "Unit Name" header row (not actual unit data)
      const before = section.substring(
        Math.max(0, unitMatch.index - 15),
        unitMatch.index,
      );
      // The pattern "Unit Name ENG14" means ENG14 IS a unit, not a skip case
      // We only skip if this looks like a column header, not data
      if (before.match(/\bUnit\s*$/)) {
        // This is the "Unit" header column followed by unit name - skip this position
        // But we need to still capture the first actual unit
        continue;
      }
      unitPositions.push({ unit: unitMatch[0], pos: unitMatch.index });
    }

    // If section starts with "Unit Name UNIT1", we need to add UNIT1 as first unit
    const firstUnitMatch = section.match(
      /Unit\s+Name\s+([A-Z]{2,}(?:\d+)?)\s+([A-Z]+,)/,
    );
    if (
      firstUnitMatch &&
      !unitPositions.find((p) => p.unit === firstUnitMatch[1])
    ) {
      const firstUnitPos = section.indexOf(firstUnitMatch[1]);
      if (firstUnitPos > 0) {
        unitPositions.unshift({ unit: firstUnitMatch[1], pos: firstUnitPos });
      }
    }

    // Parse personnel between each unit position
    for (let i = 0; i < unitPositions.length; i++) {
      const currentPos = unitPositions[i];
      const nextPos = unitPositions[i + 1];

      const startIdx = currentPos.pos + currentPos.unit.length;
      const endIdx = nextPos ? nextPos.pos : section.length;
      const personnelStr = section.substring(startIdx, endIdx);

      const names = extractPersonnelNames(personnelStr);
      if (names.length > 0) {
        personnel.push({ unit: currentPos.unit, personnel: names });
      }
    }
  }

  return personnel;
}

/**
 * Extract personnel names from a string
 */
function extractPersonnelNames(text: string): string[] {
  const names: string[] = [];
  // Match pattern: "LASTNAME, FIRSTNAME M (ID)"
  const nameMatches = text.matchAll(
    /([A-Z]+(?:\s+[A-Z]+)?,\s*[A-Z]+(?:\s+[A-Z])?)\s*\([A-Z\d]+\)/gi,
  );
  for (const match of nameMatches) {
    names.push(match[1].trim());
  }
  return names;
}

/**
 * Parse the Comments/CAD narrative section
 */
function parseComments(text: string): VisinetComment[] {
  const comments: VisinetComment[] = [];

  // Find the Comments section
  const commentsMatch = text.match(
    /Comments[\s\S]*?(?=Address Changes|Priority Changes|Alarm Level|Activity Log|$)/i,
  );
  if (!commentsMatch) return comments;

  const section = commentsMatch[0];
  const lines = section.split("\n");

  for (const line of lines) {
    // Match comment line: "01/21/2026 06:55:32 SYS Response Multiple Response..."
    const commentMatch = line.match(
      /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+)\s+(.+)/,
    );
    if (commentMatch) {
      const [, date, time, user, type, comment] = commentMatch;
      comments.push({
        date,
        time,
        user,
        type,
        comment: comment.trim(),
      });
    }
  }

  return comments;
}

/**
 * Parse Custom Time Stamps section
 */
function parseCustomTimeStamps(text: string): VisinetCustomTimeStamp[] {
  const stamps: VisinetCustomTimeStamp[] = [];

  // Find the Custom Time Stamps section
  const stampsMatch = text.match(
    /Custom Time Stamps[\s\S]*?(?=Custom Data Fields|Attachments|$)/i,
  );
  if (!stampsMatch) return stamps;

  const section = stampsMatch[0];
  const lines = section.split("\n");

  for (const line of lines) {
    // Match: "PRIM - PRIMARY Search Complete 01/21/2026 07:17:36 FD002934"
    const stampMatch = line.match(
      /(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})(?:\s+(\S+))?/,
    );
    if (stampMatch) {
      const [, description, date, time, user] = stampMatch;
      // Skip header rows
      if (
        description.toLowerCase().includes("description") ||
        description.toLowerCase().includes("date")
      )
        continue;

      stamps.push({
        description: description.trim(),
        date,
        time,
        user: user || undefined,
      });
    }
  }

  return stamps;
}

/**
 * Parse a complete Visinet report
 */
export function parseVisinetReport(text: string): VisinetReport {
  const warnings: string[] = [];

  // Parse header
  const header: VisinetIncidentHeader = {
    incidentNumber: extractField(text, "Incident number") || "",
    incidentDate: parseVisinetDateTime(
      extractField(text, "Incident Date") || "",
    ),
    reportGenerated: parseVisinetDateTime(
      extractField(text, "Report Generated") || "",
    ),
    incidentStatus: extractField(text, "Incident Status") || "",
    caseNumbers: extractField(text, "Case Numbers") || undefined,
  };

  if (!header.incidentNumber) {
    warnings.push("Could not extract incident number");
  }

  // Parse incident info
  const incidentInfo: VisinetIncidentInfo = {
    incidentType: extractField(text, "Incident Type") || "",
    alarmLevel: extractField(text, "Alarm Level") || "",
    priority: extractField(text, "Priority") || "",
    problem: extractField(text, "Problem") || "",
    determinant: extractField(text, "Determinant") || undefined,
    agency: extractField(text, "Agency") || "",
    jurisdiction: extractField(text, "Jurisdiction") || "",
    division: extractField(text, "Division") || "",
    battalion: extractField(text, "Battalion") || "",
    responseArea: extractField(text, "Response Area") || "",
    responsePlan: extractField(text, "Response Plan") || "",
    disposition: extractField(text, "Disposition") || undefined,
    primaryTAC: extractField(text, "Primary TAC") || "",
    secondaryTAC: extractField(text, "Secondary TAC") || undefined,
    certification: extractField(text, "Certification") || undefined,
  };

  // Parse location
  const latStr = extractField(text, "Latitude");
  const lonStr = extractField(text, "Longitude");
  const addressField = extractField(text, "Address") || "";
  const cityStateZip = extractField(text, "City, State, Zip") || "";

  // Parse city, state, zip
  const cszMatch = cityStateZip.match(/([^,]+),?\s*([A-Z]{2})\s*(\d{5})?/i);

  const location: VisinetLocation = {
    locationName: extractField(text, "Location Name") || undefined,
    address: addressField,
    apartment: extractField(text, "Apartment") || undefined,
    building: extractField(text, "Building") || undefined,
    city: cszMatch?.[1]?.trim() || "",
    state: cszMatch?.[2] || "",
    zip: cszMatch?.[3] || "",
    county: extractField(text, "County") || undefined,
    crossStreet: extractField(text, "Cross Street") || undefined,
    mapReference: extractField(text, "Map Reference") || undefined,
    latitude: parseCoordinate(latStr, false),
    longitude: parseCoordinate(lonStr, true),
  };

  // Parse timestamps
  const timeStamps: VisinetTimeStamps = {
    phonePickup: parseVisinetDateTime(extractField(text, "Phone Pickup") || ""),
    firstKeyStroke: parseVisinetDateTime(
      extractField(text, "1st Key Stroke") || "",
    ),
    inWaitingQueue: parseVisinetDateTime(
      extractField(text, "In Waiting Queue") || "",
    ),
    callTakingComplete: parseVisinetDateTime(
      extractField(text, "Call Taking Complete") || "",
    ),
    firstUnitAssigned: parseVisinetDateTime(
      extractField(text, "1st Unit Assigned") || "",
    ),
    firstUnitEnroute: parseVisinetDateTime(
      extractField(text, "1st Unit Enroute") || "",
    ),
    firstUnitArrived: parseVisinetDateTime(
      extractField(text, "1st Unit Arrived") || "",
    ),
    closed: parseVisinetDateTime(extractField(text, "Closed") || ""),
  };

  // Parse elapsed times
  const elapsedTimes: VisinetElapsedTimes = {
    receivedToInQueue: extractField(text, "Received to In Queue") || undefined,
    callTaking: extractField(text, "Call Taking") || undefined,
    inQueueToFirstAssign:
      extractField(text, "In Queue to 1st Assign") || undefined,
    callReceivedToFirstAssign:
      extractField(text, "Call Received to 1st Assign") || undefined,
    assignedToFirstEnroute:
      extractField(text, "Assigned to 1st Enroute") || undefined,
    enrouteToFirstArrived:
      extractField(text, "Enroute to 1st Arrived") || undefined,
    incidentDuration: extractField(text, "Incident Duration") || undefined,
  };

  // Parse units, personnel, comments, custom timestamps
  const unitsAssigned = parseUnitsAssigned(text);
  const personnel = parsePersonnel(text);
  const comments = parseComments(text);
  const customTimeStamps = parseCustomTimeStamps(text);

  if (unitsAssigned.length === 0) {
    warnings.push("No units found in Resources Assigned section");
  }

  return {
    header,
    incidentInfo,
    location,
    timeStamps,
    elapsedTimes,
    unitsAssigned,
    personnel,
    comments,
    customTimeStamps,
    rawText: text,
    parseWarnings: warnings,
  };
}

/**
 * Format a Visinet report as context for analysis prompts
 */
export function formatVisinetForAnalysis(report: VisinetReport): string {
  const sections: string[] = [];

  // Header
  sections.push("## Visinet CAD Report Summary");
  sections.push("");

  // Incident overview
  sections.push("### Incident Information");
  sections.push(`- **Incident #:** ${report.header.incidentNumber}`);
  if (report.header.incidentDate) {
    sections.push(
      `- **Date/Time:** ${report.header.incidentDate.toLocaleString()}`,
    );
  }
  sections.push(`- **Type:** ${report.incidentInfo.problem}`);
  sections.push(`- **Alarm Level:** ${report.incidentInfo.alarmLevel}`);
  sections.push(`- **Priority:** ${report.incidentInfo.priority}`);
  sections.push("");

  // Location
  sections.push("### Location");
  if (report.location.locationName) {
    sections.push(`- **Name:** ${report.location.locationName}`);
  }
  sections.push(`- **Address:** ${report.location.address}`);
  sections.push(
    `- **City:** ${report.location.city}, ${report.location.state} ${report.location.zip}`,
  );
  if (report.location.crossStreet) {
    sections.push(`- **Cross Street:** ${report.location.crossStreet}`);
  }
  sections.push("");

  // Response timeline
  sections.push("### Response Timeline");
  if (report.timeStamps.phonePickup) {
    sections.push(
      `- **Call Received:** ${report.timeStamps.phonePickup.toLocaleTimeString()}`,
    );
  }
  if (report.timeStamps.firstUnitAssigned) {
    sections.push(
      `- **1st Unit Assigned:** ${report.timeStamps.firstUnitAssigned.toLocaleTimeString()}`,
    );
  }
  if (report.timeStamps.firstUnitEnroute) {
    sections.push(
      `- **1st Unit Enroute:** ${report.timeStamps.firstUnitEnroute.toLocaleTimeString()}`,
    );
  }
  if (report.timeStamps.firstUnitArrived) {
    sections.push(
      `- **1st Unit Arrived:** ${report.timeStamps.firstUnitArrived.toLocaleTimeString()}`,
    );
  }
  sections.push("");

  // Elapsed times
  if (report.elapsedTimes.callReceivedToFirstAssign) {
    sections.push("### Elapsed Times");
    sections.push(
      `- **Dispatch Time:** ${report.elapsedTimes.callReceivedToFirstAssign}`,
    );
    if (report.elapsedTimes.assignedToFirstEnroute) {
      sections.push(
        `- **Turnout Time:** ${report.elapsedTimes.assignedToFirstEnroute}`,
      );
    }
    if (report.elapsedTimes.enrouteToFirstArrived) {
      sections.push(
        `- **Travel Time:** ${report.elapsedTimes.enrouteToFirstArrived}`,
      );
    }
    sections.push("");
  }

  // Units assigned
  if (report.unitsAssigned.length > 0) {
    sections.push("### Units Assigned");
    for (const unit of report.unitsAssigned) {
      const primary = unit.isPrimary ? " (Primary)" : "";
      const times = [
        unit.assigned ? `Assigned: ${unit.assigned}` : null,
        unit.enroute ? `Enroute: ${unit.enroute}` : null,
        unit.arrived ? `Arrived: ${unit.arrived}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      sections.push(`- **${unit.unit}**${primary}: ${times}`);
    }
    sections.push("");
  }

  // Custom time stamps (fire under control, search complete, etc.)
  if (report.customTimeStamps.length > 0) {
    sections.push("### Incident Milestones");
    for (const stamp of report.customTimeStamps) {
      sections.push(`- **${stamp.description}:** ${stamp.time}`);
    }
    sections.push("");
  }

  // Key CAD comments (filter to important ones)
  const keyComments = report.comments.filter((c) => {
    const lower = c.comment.toLowerCase();
    return (
      lower.includes("on scene") ||
      lower.includes("command") ||
      lower.includes("offensive") ||
      lower.includes("defensive") ||
      lower.includes("fire") ||
      lower.includes("search") ||
      lower.includes("knockdown") ||
      lower.includes("control") ||
      lower.includes("ric") ||
      lower.includes("mayday") ||
      lower.includes("rescue")
    );
  });

  if (keyComments.length > 0) {
    sections.push("### Key CAD Narrative Entries");
    for (const comment of keyComments.slice(0, 20)) {
      // Limit to 20 key comments
      sections.push(`- [${comment.time}] ${comment.comment}`);
    }
    sections.push("");
  }

  return sections.join("\n");
}

/**
 * Extract incident metadata that can auto-populate analysis fields
 */
export function extractIncidentMetadata(report: VisinetReport): {
  incidentNumber: string;
  incidentDate: Date | null;
  locationName: string;
  address: string;
  incidentType: string;
  alarmLevel: string;
  primaryUnit: string | null;
  totalUnits: number;
  firstArrivalTime: Date | null;
  fireUnderControlTime: string | null;
} {
  // Find primary unit
  const primaryUnit = report.unitsAssigned.find((u) => u.isPrimary);

  // Find "Fire Under Control" custom timestamp
  const fireUnderControl = report.customTimeStamps.find((ts) =>
    ts.description.toLowerCase().includes("fire under control"),
  );

  return {
    incidentNumber: report.header.incidentNumber,
    incidentDate: report.header.incidentDate,
    locationName: report.location.locationName || "",
    address: report.location.address,
    incidentType: report.incidentInfo.problem,
    alarmLevel: report.incidentInfo.alarmLevel,
    primaryUnit: primaryUnit?.unit || null,
    totalUnits: report.unitsAssigned.length,
    firstArrivalTime: report.timeStamps.firstUnitArrived,
    fireUnderControlTime: fireUnderControl?.time || null,
  };
}
