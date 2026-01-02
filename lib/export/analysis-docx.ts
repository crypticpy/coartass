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
    spacing: { before: 400, after: 200 },
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
  } = {}
): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: options.bold,
        italics: options.italic,
        color: options.color,
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

  if (analysis.results.actionItems && analysis.results.actionItems.length > 0) {
    addRow("Action Items", String(analysis.results.actionItems.length));
  }

  if (analysis.results.decisions && analysis.results.decisions.length > 0) {
    addRow("Decisions", String(analysis.results.decisions.length));
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

/**
 * Create action items table
 */
function createActionItemsTable(
  actionItems: NonNullable<Analysis["results"]["actionItems"]>
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [
    createHeading("Action Items", HeadingLevel.HEADING_1),
  ];

  // Header row
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [createParagraph("Task", { bold: true })],
        width: { size: 45, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: COLORS.secondary },
      }),
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: "Owner", bold: true, color: "FFFFFF" })],
          }),
        ],
        width: { size: 20, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: COLORS.secondary },
      }),
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: "Deadline", bold: true, color: "FFFFFF" })],
          }),
        ],
        width: { size: 20, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: COLORS.secondary },
      }),
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: "Time", bold: true, color: "FFFFFF" })],
          }),
        ],
        width: { size: 15, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: COLORS.secondary },
      }),
    ],
    tableHeader: true,
  });

  // Data rows
  const dataRows = actionItems.map(
    (item, index) =>
      new TableRow({
        children: [
          new TableCell({
            children: [createParagraph(item.task)],
            shading:
              index % 2 === 1
                ? { type: ShadingType.SOLID, color: COLORS.light }
                : undefined,
          }),
          new TableCell({
            children: [createParagraph(item.owner || "-")],
            shading:
              index % 2 === 1
                ? { type: ShadingType.SOLID, color: COLORS.light }
                : undefined,
          }),
          new TableCell({
            children: [createParagraph(item.deadline || "-")],
            shading:
              index % 2 === 1
                ? { type: ShadingType.SOLID, color: COLORS.light }
                : undefined,
          }),
          new TableCell({
            children: [
              createParagraph(
                item.timestamp !== undefined
                  ? formatTimestamp(item.timestamp)
                  : "-"
              ),
            ],
            shading:
              index % 2 === 1
                ? { type: ShadingType.SOLID, color: COLORS.light }
                : undefined,
          }),
        ],
      })
  );

  elements.push(
    new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  );

  return elements;
}

/**
 * Create decisions timeline
 */
function createDecisionsSection(
  decisions: NonNullable<Analysis["results"]["decisions"]>
): Paragraph[] {
  const paragraphs: Paragraph[] = [
    createHeading("Decisions Timeline", HeadingLevel.HEADING_1),
  ];

  for (const decision of decisions) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `[${formatTimestamp(decision.timestamp)}] `,
            bold: true,
            color: COLORS.success,
          }),
          new TextRun({
            text: decision.decision,
            bold: true,
          }),
        ],
        spacing: { before: 200, after: 80 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 16, color: COLORS.primary },
        },
        indent: { left: 200 },
      })
    );

    if (decision.context) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: decision.context,
              italics: true,
              color: COLORS.accent,
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

/**
 * Create quotes section
 */
function createQuotesSection(
  quotes: NonNullable<Analysis["results"]["quotes"]>
): Paragraph[] {
  const paragraphs: Paragraph[] = [
    createHeading("Notable Quotes", HeadingLevel.HEADING_1),
  ];

  for (const quote of quotes) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `"${quote.text}"`,
            italics: true,
          }),
        ],
        spacing: { before: 160, after: 80 },
        shading: { type: ShadingType.SOLID, color: COLORS.light },
        border: {
          left: { style: BorderStyle.SINGLE, size: 12, color: COLORS.accent },
        },
        indent: { left: 200, right: 200 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: quote.speaker ? `\u2014 ${quote.speaker}  ` : "",
            color: COLORS.primary,
            bold: true,
          }),
          new TextRun({
            text: `[${formatTimestamp(quote.timestamp)}]`,
            color: COLORS.accent,
            size: 18,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 200 },
        indent: { right: 200 },
      })
    );
  }

  return paragraphs;
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

  // Action Items
  if (
    options.includeActionItems &&
    analysis.results.actionItems &&
    analysis.results.actionItems.length > 0
  ) {
    tables.push(...createActionItemsTable(analysis.results.actionItems));
    tables.push(new Paragraph({ spacing: { after: 400 } }));
  }

  // Decisions
  if (
    options.includeDecisions &&
    analysis.results.decisions &&
    analysis.results.decisions.length > 0
  ) {
    tables.push(...createDecisionsSection(analysis.results.decisions));
  }

  // Quotes
  if (
    options.includeQuotes &&
    analysis.results.quotes &&
    analysis.results.quotes.length > 0
  ) {
    tables.push(...createQuotesSection(analysis.results.quotes));
  }

  // Create the document
  const doc = new Document({
    title: `Analysis - ${transcript.filename}`,
    creator: "Meeting Transcriber",
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
                    text: "Generated with Meeting Transcriber  |  Page ",
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
