/**
 * Tests for Visinet Report Parser
 */

import { describe, test, expect } from "vitest";
import {
  isVisinetReport,
  parseVisinetReport,
  formatVisinetForAnalysis,
  extractIncidentMetadata,
} from "../visinet-parser";

// Sample Visinet text extracted from a real report
const sampleVisinetText = `Incident Detail Report
Data Source: Data Warehouse
Incident Status: Active
Incident number: 26008775
Incident Date: 01/21/2026 06:55:09
Report Generated: 01/21/2026 08:50:35

Incident Type: A - Box Alarm
Alarm Level: 1
Priority: 1F
Problem: BOX -Structure Fire
Agency: FIRE
Jurisdiction: AFD
Division: AFD_B07
Battalion: AFD_BAT07
Response Area: 00-1401
Response Plan: 00- A - Box Alarm
Primary TAC: FTAC 201
Secondary TAC: TRV MCOM-C

Location Name: BARTHOLOMEW PARK
Address: 1700-2002 E 51st St
City, State, Zip: AUSTIN TX 78723
County: TRAVIS
Cross Street: BERKMAN DR/E 51ST ST TO STATION
Latitude: 30302361
Longitude: 97697293

Phone Pickup: 01/21/2026 06:55:09
1st Unit Assigned: 01/21/2026 06:55:36
1st Unit Enroute: 01/21/2026 06:56:42
1st Unit Arrived: 01/21/2026 07:00:09

Call Received to 1st Assign: 00:00:27
Assigned to 1st Enroute: 00:01:06.2
Enroute to 1st Arrived: 00:03:27.5

Resources Assigned
Unit Primary Flag Assigned Disposition Enroute Staged Arrived Complete
ENG14 Y 06:55:36 06:57:55 07:00:09 08:18:48
RES14 N 06:56:32 Fire - Fire Incident 06:58:07 07:00:41 08:24:28
ENG18 N 06:56:32 06:57:48 07:01:45 08:02:07

Personnel Assigned
ENG14 BROWNLEE, JACOB W (FD002618) - AFD - Active; CANTU, MARCOS J (FD001769) - AFD - Active

Custom Time Stamps
Description Date Time User
PRIM - PRIMARY Search Complete 01/21/2026 07:17:36 FD002934
Fire Under Control 01/21/2026 07:17:50 FD002934

Comments
Date Time User Type Comments
01/21/2026 06:55:52 FD002934 Response CALLER SEES SMOKE COMING FROM POOL AREA
01/21/2026 07:00:13 FD002934 Response ENG14 ON SCENE, ASSUMING COMMAND
01/21/2026 07:00:56 FD002934 Response BUILDING ON FIRE, LIMESTONE, PULLING RACKLINE, OFFENSIVE MODE
01/21/2026 07:06:15 FD002934 Response FIRE KNOCKED DOWN
01/21/2026 07:17:55 FD002934 Response FIRE UNDER CONTROL`;

describe("isVisinetReport", () => {
  test("identifies valid Visinet report text", () => {
    expect(isVisinetReport(sampleVisinetText)).toBe(true);
  });

  test("rejects non-Visinet text", () => {
    expect(isVisinetReport("This is just random text")).toBe(false);
    expect(isVisinetReport("Some other incident report format")).toBe(false);
  });

  test("handles edge case with partial indicators", () => {
    // Only one indicator isn't enough
    expect(isVisinetReport("Incident Detail Report")).toBe(false);
    // Two indicators should be enough
    expect(isVisinetReport("Incident Detail Report\nResources Assigned")).toBe(
      true,
    );
  });
});

describe("parseVisinetReport", () => {
  const report = parseVisinetReport(sampleVisinetText);

  test("extracts incident header", () => {
    expect(report.header.incidentNumber).toBe("26008775");
    expect(report.header.incidentDate).toBeInstanceOf(Date);
    expect(report.header.incidentStatus).toBe("Active");
  });

  test("extracts incident info", () => {
    expect(report.incidentInfo.incidentType).toBe("A - Box Alarm");
    expect(report.incidentInfo.alarmLevel).toBe("1");
    expect(report.incidentInfo.problem).toBe("BOX -Structure Fire");
    expect(report.incidentInfo.primaryTAC).toBe("FTAC 201");
  });

  test("extracts location", () => {
    expect(report.location.locationName).toBe("BARTHOLOMEW PARK");
    expect(report.location.address).toBe("1700-2002 E 51st St");
    expect(report.location.city).toBe("AUSTIN");
    expect(report.location.state).toBe("TX");
    expect(report.location.zip).toBe("78723");
    expect(report.location.latitude).toBeCloseTo(30.302361, 5);
    expect(report.location.longitude).toBeCloseTo(-97.697293, 5);
  });

  test("extracts timestamps", () => {
    expect(report.timeStamps.phonePickup).toBeInstanceOf(Date);
    expect(report.timeStamps.firstUnitAssigned).toBeInstanceOf(Date);
    expect(report.timeStamps.firstUnitEnroute).toBeInstanceOf(Date);
    expect(report.timeStamps.firstUnitArrived).toBeInstanceOf(Date);
  });

  test("extracts elapsed times", () => {
    expect(report.elapsedTimes.callReceivedToFirstAssign).toBe("00:00:27");
    expect(report.elapsedTimes.assignedToFirstEnroute).toBe("00:01:06.2");
    expect(report.elapsedTimes.enrouteToFirstArrived).toBe("00:03:27.5");
  });

  test("extracts units assigned", () => {
    expect(report.unitsAssigned.length).toBeGreaterThan(0);
    const primaryUnit = report.unitsAssigned.find((u) => u.isPrimary);
    expect(primaryUnit).toBeDefined();
    expect(primaryUnit?.unit).toBe("ENG14");
  });

  test("extracts custom timestamps", () => {
    expect(report.customTimeStamps.length).toBeGreaterThan(0);
    const fireUnderControl = report.customTimeStamps.find((ts) =>
      ts.description.includes("Fire Under Control"),
    );
    expect(fireUnderControl).toBeDefined();
    expect(fireUnderControl?.time).toBe("07:17:50");
  });
});

describe("formatVisinetForAnalysis", () => {
  test("produces formatted markdown output", () => {
    const report = parseVisinetReport(sampleVisinetText);
    const formatted = formatVisinetForAnalysis(report);

    expect(formatted).toContain("## Visinet CAD Report Summary");
    expect(formatted).toContain("26008775");
    expect(formatted).toContain("BARTHOLOMEW PARK");
    expect(formatted).toContain("BOX -Structure Fire");
  });
});

describe("extractIncidentMetadata", () => {
  test("extracts key metadata for auto-population", () => {
    const report = parseVisinetReport(sampleVisinetText);
    const metadata = extractIncidentMetadata(report);

    expect(metadata.incidentNumber).toBe("26008775");
    expect(metadata.locationName).toBe("BARTHOLOMEW PARK");
    expect(metadata.incidentType).toBe("BOX -Structure Fire");
    expect(metadata.primaryUnit).toBe("ENG14");
    expect(metadata.totalUnits).toBe(3);
    expect(metadata.fireUnderControlTime).toBe("07:17:50");
  });
});
