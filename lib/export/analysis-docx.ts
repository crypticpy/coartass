/**
 * Analysis Word Document Export
 *
 * Generates native .docx files using the docx library.
 * Produces professional, editable documents compatible with Microsoft Word and Google Docs.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  TableOfContents,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from "docx";
import type { Analysis, Transcript, Template } from "@/types";
import type { ExportOptions } from "./analysis-exporter";
import { formatTimestamp, formatDate } from "./analysis-exporter";
import { stripTimestamps } from "@/lib/analysis-utils";

/**
 * Color scheme for professional styling
 */
const COLORS = {
  primary: "0066CC", // Professional blue
  secondary: "333333", // Dark gray
  accent: "666666", // Medium gray
  light: "F5F5F5", // Light gray background
  border: "CCCCCC", // Border gray
  success: "2E7D32", // Green for decisions
  warning: "F59E0B",
  danger: "DC2626",
};

/**
 * Create a styled heading paragraph
 */
function createHeading(
  text: string,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel]
): Paragraph {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 300, after: 150 },
  });
}

/**
 * Create a paragraph with custom styling
 */
function createParagraph(
  text: string,
  options: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    spacing?: { before?: number; after?: number };
    indent?: number;
    size?: number;
  } = {}
): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: options.bold,
        italics: options.italic,
        color: options.color,
        size: options.size,
      }),
    ],
    spacing: options.spacing || { after: 120 },
    indent: options.indent ? { left: options.indent } : undefined,
  });
}


/**
 * Create metadata table
 */
function createMetadataSection(
  analysis: Analysis,
  transcript: Transcript,
  template: Template
): Table {
  const rows: TableRow[] = [];

  const addRow = (label: string, value: string) => {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [createParagraph(label, { bold: true })],
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: COLORS.light },
          }),
          new TableCell({
            children: [createParagraph(value)],
            width: { size: 75, type: WidthType.PERCENTAGE },
          }),
        ],
      })
    );
  };

  addRow("Source File", transcript.filename);
  addRow("Template", template.name);
  addRow("Category", template.category.charAt(0).toUpperCase() + template.category.slice(1));
  addRow("Analyzed", formatDate(analysis.createdAt));
  addRow("Sections", String(analysis.results.sections.length));

  if (analysis.results.benchmarks && analysis.results.benchmarks.length > 0) {
    addRow("Benchmarks", String(analysis.results.benchmarks.length));
  }

  if (analysis.results.radioReports && analysis.results.radioReports.length > 0) {
    addRow("Radio Reports", String(analysis.results.radioReports.length));
  }

  if (analysis.results.safetyEvents && analysis.results.safetyEvents.length > 0) {
    addRow("Safety Events", String(analysis.results.safetyEvents.length));
  }

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

/**
 * Create executive summary section
 * Timestamps are stripped for clean copy/paste output
 */
function createSummarySection(summary: string): Paragraph[] {
  return [
    createHeading("Executive Summary", HeadingLevel.HEADING_1),
    new Paragraph({
      children: [
        new TextRun({
          // Strip timestamps from executive summary for clean copy/paste output
          text: stripTimestamps(summary),
        }),
      ],
      spacing: { after: 200, line: 360 },
      shading: { type: ShadingType.SOLID, color: "F0F7FF" },
      border: {
        left: { style: BorderStyle.SINGLE, size: 24, color: COLORS.primary },
      },
    }),
  ];
}

/**
 * Filter evidence to only include items with valid data
 * Prevents NaN values when evidence was disabled during analysis
 */
function filterValidEvidence(evidence: Analysis["results"]["sections"][0]["evidence"]) {
  return evidence?.filter(
    (e) =>
      e.text &&
      typeof e.start === "number" &&
      !isNaN(e.start) &&
      typeof e.end === "number" &&
      !isNaN(e.end) &&
      typeof e.relevance === "number" &&
      !isNaN(e.relevance)
  );
}

/**
 * Create analysis section with evidence
 */
function createAnalysisSection(
  section: Analysis["results"]["sections"][0],
  includeEvidence: boolean
): Paragraph[] {
  const paragraphs: Paragraph[] = [
    createHeading(section.name, HeadingLevel.HEADING_2),
    new Paragraph({
      children: [
        new TextRun({
          text: section.content,
        }),
      ],
      spacing: { after: 200, line: 360 },
    }),
  ];

  // Filter evidence to only include valid items
  const validEvidence = filterValidEvidence(section.evidence);

  if (includeEvidence && validEvidence && validEvidence.length > 0) {
    paragraphs.push(
      createParagraph("Evidence Citations:", {
        bold: true,
        color: COLORS.accent,
        spacing: { before: 200, after: 100 },
      })
    );

    for (const evidence of validEvidence) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `"${evidence.text}"`,
              italics: true,
              color: COLORS.secondary,
            }),
          ],
          spacing: { after: 40 },
          indent: { left: 400 },
          border: {
            left: { style: BorderStyle.SINGLE, size: 8, color: COLORS.border },
          },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[${formatTimestamp(evidence.start)} - ${formatTimestamp(evidence.end)}] `,
              color: COLORS.accent,
              size: 18,
            }),
            new TextRun({
              text: `Relevance: ${Math.round(evidence.relevance * 100)}%`,
              color: COLORS.accent,
              size: 18,
            }),
          ],
          spacing: { after: 160 },
          indent: { left: 400 },
        })
      );
    }
  }

  return paragraphs;
}

function createBenchmarksTable(
  benchmarks: NonNullable<Analysis["results"]["benchmarks"]>
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [
    createHeading("Benchmarks & Milestones", HeadingLevel.HEADING_1),
  ];

  const headerRow = new TableRow({
    tableHeader: true,
    children: ["Benchmark", "Status", "Time", "Unit/Role", "Evidence", "Notes"].map((label) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, bold: true, color: "FFFFFF" })],
            spacing: { after: 80 },
          }),
        ],
        shading: { type: ShadingType.SOLID, color: COLORS.secondary },
      })
    ),
  });

  const rows = benchmarks.map((b, idx) => {
    const shading =
      idx % 2 === 1 ? { type: ShadingType.SOLID, color: COLORS.light } : undefined;
    const statusColor =
      b.status === "met"
        ? COLORS.success
        : b.status === "missed"
          ? COLORS.danger
          : b.status === "not_observed"
            ? COLORS.warning
            : COLORS.accent;
    return new TableRow({
      children: [
        new TableCell({ children: [createParagraph(b.benchmark)], shading }),
        new TableCell({
          children: [createParagraph(b.status.replace("_", " "), { color: statusColor, bold: true })],
          shading,
        }),
        new TableCell({
          children: [createParagraph(b.timestamp !== undefined ? formatTimestamp(b.timestamp) : "-")],
          shading,
        }),
        new TableCell({ children: [createParagraph(b.unitOrRole || "-")], shading }),
        new TableCell({ children: [createParagraph(b.evidenceQuote || "-")], shading }),
        new TableCell({ children: [createParagraph(b.notes || "-")], shading }),
      ],
    });
  });

  elements.push(
    new Table({
      rows: [headerRow, ...rows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  );

  return elements;
}

function createRadioReportsSection(
  radioReports: NonNullable<Analysis["results"]["radioReports"]>
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [
    createHeading("Radio Reports & CAN", HeadingLevel.HEADING_1),
  ];

  radioReports.forEach((r, idx) => {
    elements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `[${formatTimestamp(r.timestamp)}] ${r.type.replace(/_/g, " ").toUpperCase()}`,
            bold: true,
            color: COLORS.primary,
            size: 22,
          }),
          new TextRun({
            text: r.from ? `  |  ${r.from}` : "",
            color: COLORS.accent,
            size: 20,
          }),
        ],
        spacing: { before: idx === 0 ? 100 : 200, after: 80 },
      })
    );

    if (r.fields && Object.keys(r.fields).length > 0) {
      Object.entries(r.fields).forEach(([key, value]) => {
        elements.push(
          createParagraph(`${key}: ${String(value)}`, { indent: 400, color: COLORS.secondary })
        );
      });
    }

    if (r.evidenceQuote) {
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: `"${r.evidenceQuote}"`, italics: true, color: COLORS.accent })],
          indent: { left: 400 },
          spacing: { after: 80 },
        })
      );
    }

    if (r.missingRequired && r.missingRequired.length > 0) {
      elements.push(
        createParagraph(`Missing: ${r.missingRequired.join(", ")}`, {
          indent: 400,
          color: COLORS.warning,
          bold: true,
        })
      );
    }
  });

  return elements;
}

function createSafetyEventsSection(
  safetyEvents: NonNullable<Analysis["results"]["safetyEvents"]>
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [
    createHeading("Safety & Accountability Events", HeadingLevel.HEADING_1),
  ];

  safetyEvents.forEach((e) => {
    const color =
      e.severity === "critical"
        ? COLORS.danger
        : e.severity === "warning"
          ? COLORS.warning
          : COLORS.accent;
    elements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `[${formatTimestamp(e.timestamp)}] ${e.type.replace(/_/g, " ").toUpperCase()}`,
            bold: true,
            color,
            size: 22,
          }),
          new TextRun({
            text: e.unitOrRole ? `  |  ${e.unitOrRole}` : "",
            color: COLORS.secondary,
            size: 20,
          }),
        ],
        spacing: { before: 200, after: 80 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 16, color },
        },
        indent: { left: 200 },
      })
    );
    elements.push(
      createParagraph(e.details, { indent: 400, color: COLORS.secondary })
    );
    if (e.evidenceQuote) {
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: `"${e.evidenceQuote}"`, italics: true, color: COLORS.accent })],
          indent: { left: 400 },
          spacing: { after: 80 },
        })
      );
    }
  });

  return elements;
}

/**
 * Generate the Word document
 */
export async function generateAnalysisDocx(
  analysis: Analysis,
  transcript: Transcript,
  template: Template,
  options: Required<ExportOptions>
): Promise<Blob> {
  const sections: Paragraph[] = [];
  const tables: (Paragraph | Table)[] = [];

  // Title
  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Analysis Report",
          bold: true,
          size: 48,
          color: COLORS.secondary,
        }),
      ],
      spacing: { after: 100 },
    })
  );

  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: transcript.filename,
          size: 24,
          color: COLORS.accent,
        }),
      ],
      spacing: { after: 100 },
    })
  );

  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Template: ${template.name}`,
          size: 22,
          color: COLORS.accent,
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Metadata
  if (options.includeMetadata) {
    tables.push(createMetadataSection(analysis, transcript, template));
    tables.push(new Paragraph({ spacing: { after: 400 } }));
  }

  // Table of Contents
  if (options.includeTOC) {
    tables.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Table of Contents",
            bold: true,
            size: 28,
          }),
        ],
        spacing: { after: 200 },
      })
    );
    tables.push(
      new TableOfContents("Table of Contents", {
        hyperlink: true,
        headingStyleRange: "1-3",
      })
    );
    tables.push(new Paragraph({ spacing: { after: 400 } }));
  }

  // Executive Summary
  if (options.includeSummary && analysis.results.summary) {
    tables.push(...createSummarySection(analysis.results.summary));
  }

  // Analysis Sections
  if (options.includeSections) {
    for (const section of analysis.results.sections) {
      tables.push(...createAnalysisSection(section, options.includeEvidence));
    }
  }

  if (options.includeBenchmarks && analysis.results.benchmarks?.length) {
    tables.push(...createBenchmarksTable(analysis.results.benchmarks));
    tables.push(new Paragraph({ spacing: { after: 300 } }));
  }

  if (options.includeRadioReports && analysis.results.radioReports?.length) {
    tables.push(...createRadioReportsSection(analysis.results.radioReports));
    tables.push(new Paragraph({ spacing: { after: 300 } }));
  }

  if (options.includeSafetyEvents && analysis.results.safetyEvents?.length) {
    tables.push(...createSafetyEventsSection(analysis.results.safetyEvents));
    tables.push(new Paragraph({ spacing: { after: 300 } }));
  }

  // Create the document
  const doc = new Document({
    title: `Analysis - ${transcript.filename}`,
    creator: "Austin RTASS",
    description: "Transcript Analysis Report",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Analysis Report - ${transcript.filename}`,
                    color: COLORS.accent,
                    size: 18,
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Generated with Austin RTASS  |  Page ",
                    color: COLORS.accent,
                    size: 18,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    color: COLORS.accent,
                    size: 18,
                  }),
                  new TextRun({
                    text: " of ",
                    color: COLORS.accent,
                    size: 18,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    color: COLORS.accent,
                    size: 18,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [...sections, ...tables],
      },
    ],
    numbering: {
      config: [
        {
          reference: "default-bullet",
          levels: [
            {
              level: 0,
              format: NumberFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
  });

  // Generate the blob
  const buffer = await Packer.toBlob(doc);
  return buffer;
}
