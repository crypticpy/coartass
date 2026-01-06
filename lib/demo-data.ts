/**
 * Demo Data for Austin RTASS
 *
 * Provides sample lorem ipsum content for demonstration purposes.
 * This data can be loaded into IndexedDB to showcase the app's features
 * without requiring real audio transcriptions.
 */

import type { Transcript, TranscriptSegment } from '@/types/transcript';
import type { Analysis, AnalysisResults, AnalysisSection, ActionItem, Decision, Quote } from '@/types/analysis';

/**
 * Generate a unique ID for demo data
 */
function generateDemoId(prefix: string): string {
  return `demo-${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate transcript segments from text with realistic timestamps
 */
function generateSegments(text: string, baseDuration: number): TranscriptSegment[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const segmentDuration = baseDuration / sentences.length;

  return sentences.map((sentence, index) => ({
    index,
    start: index * segmentDuration,
    end: (index + 1) * segmentDuration,
    text: sentence.trim(),
    speaker: index % 3 === 0 ? 'Speaker 1' : index % 3 === 1 ? 'Speaker 2' : 'Speaker 3',
  }));
}

/**
 * Sample transcript: Weekly Team Standup
 */
export const demoTranscript1: Omit<Transcript, 'id'> = {
  filename: 'Weekly Team Standup - Dec 15.mp3',
  text: `Good morning everyone, let's get started with our weekly standup. First, I want to go around and hear updates from each team. Sarah, can you start us off?

Thanks, Mike. So this week the frontend team completed the new dashboard redesign. We've implemented all the charts and graphs that were requested in the design specs. The user feedback has been really positive so far. Our next focus will be on improving load times and adding some accessibility features.

That sounds great, Sarah. What about the timeline for accessibility updates?

We're planning to have the first round of accessibility improvements done by end of next week. We've already identified the main areas that need work - primarily around screen reader support and keyboard navigation.

Perfect. David, how's the backend work going?

The API refactoring is about 80% complete. We've migrated most of the legacy endpoints to the new GraphQL schema. There's been some complexity with the authentication layer, but we should be finished by Wednesday.

Any blockers we should know about?

The main concern is the database migration for the user preferences table. We need to coordinate with the DevOps team to schedule the migration window. I've already reached out to them.

Good. Let's make sure that gets scheduled this week. Lisa, what's the status on the mobile app?

We shipped version 2.5 to the app stores yesterday. The main features are push notifications for meeting reminders and the new dark mode theme. We're now monitoring for any issues and collecting user feedback.

Excellent progress all around. Before we wrap up, are there any other items we need to discuss?

I wanted to mention that we have the quarterly planning session scheduled for next Thursday. Please make sure to have your team's priorities documented beforehand.

Thanks for the reminder. Alright, let's keep up the great work. Same time next week everyone.`,
  segments: [],
  createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  metadata: {
    model: 'whisper-1',
    language: 'en',
    fileSize: 15728640, // ~15MB
    duration: 847, // ~14 minutes
  },
  summary: 'Weekly team standup covering frontend dashboard redesign completion, backend API refactoring progress, and mobile app v2.5 release.',
};

/**
 * Sample transcript: Project Planning Meeting
 */
export const demoTranscript2: Omit<Transcript, 'id'> = {
  filename: 'Q1 Project Planning Session.m4a',
  text: `Welcome everyone to our Q1 planning session. Today we'll be reviewing our roadmap and setting priorities for the coming quarter. Let's start by looking at what we accomplished last quarter.

Last quarter we successfully launched three major features - the real-time collaboration tools, the advanced analytics dashboard, and the mobile app overhaul. Customer satisfaction scores increased by 15% and we reduced churn by 8%.

Those are impressive numbers. What learnings can we carry forward?

One key learning is that smaller, more frequent releases work better than big bang launches. We also found that involving customers early in the design process leads to better adoption.

That's valuable insight. Now let's discuss Q1 priorities. I've identified four major initiatives we should consider.

The first initiative is enterprise security features. Several large potential customers have requested SOC 2 compliance and advanced access controls. This could unlock significant revenue.

What's the estimated timeline for SOC 2 compliance?

Based on our assessment, we're looking at 3-4 months to implement the technical controls, plus another month for the audit process.

The second initiative is the AI-powered meeting summaries feature. This aligns with market trends and has been our most requested feature for the past six months.

I love this idea. How complex is the integration?

We've done some preliminary work with OpenAI's APIs. The core functionality could be ready in 6-8 weeks, with another 4 weeks for refinement and testing.

The third initiative is expanding our integration ecosystem. Specifically, we should prioritize Slack, Microsoft Teams, and Zoom integrations.

And the fourth initiative?

International expansion. We have growing interest from European and Asian markets. This would involve localization, GDPR compliance, and potentially local data centers.

Let's vote on priorities. Given our resources, we can realistically tackle two of these initiatives this quarter.

I vote for enterprise security and AI summaries. Security unlocks enterprise deals, and AI is our competitive advantage.

I agree. Let's make those our Q1 focus. We'll plan the integration and international work for Q2.

Perfect. Let's break into working groups to detail out the implementation plans. We'll reconvene in two hours to share our proposals.`,
  segments: [],
  createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
  metadata: {
    model: 'whisper-1',
    language: 'en',
    fileSize: 31457280, // ~30MB
    duration: 1823, // ~30 minutes
  },
  summary: 'Q1 planning session reviewing last quarter achievements and prioritizing enterprise security features and AI-powered meeting summaries.',
};

/**
 * Sample transcript: Customer Interview
 */
export const demoTranscript3: Omit<Transcript, 'id'> = {
  filename: 'Customer Interview - Acme Corp.wav',
  text: `Thank you for taking the time to speak with us today. We really value your feedback as a customer. Can you start by telling us about your team and how you use our product?

Sure. We're a team of about 50 people spread across three time zones. We use your product primarily for our weekly all-hands meetings and department standups. It's been really helpful for keeping remote team members in the loop.

That's great to hear. What aspects of the product do you find most valuable?

Honestly, the transcription accuracy is what sold us. We tried several other solutions, but yours consistently performs better with technical jargon and multiple speakers. The search functionality is also excellent - I can quickly find specific discussions from past meetings.

Are there any challenges or pain points you've experienced?

The main one is around exporting. We often need to share meeting summaries with stakeholders who don't have accounts. Right now, we have to copy and paste, which is tedious for longer meetings.

That's helpful feedback. What would an ideal export solution look like for you?

I'd love a one-click export to PDF with automatic formatting. Maybe also the ability to share a read-only link that expires after a certain time.

We're actually working on something similar. Any other features on your wishlist?

Integration with our project management tool would be amazing. If action items from meetings could automatically create tasks in Asana or Jira, that would save us hours each week.

How do you currently handle action items from meetings?

We have someone manually extract them and enter them into Asana. It usually takes 15-20 minutes per meeting and things sometimes get missed.

That's exactly the kind of friction we want to eliminate. On a scale of 1-10, how likely are you to recommend our product to others?

I'd say an 8. The core product is excellent. With the export and integration features, it would be a 10.

Thank you so much for your candid feedback. This is incredibly valuable for our product roadmap.`,
  segments: [],
  createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
  metadata: {
    model: 'whisper-1',
    language: 'en',
    fileSize: 22020096, // ~21MB
    duration: 1256, // ~21 minutes
  },
  summary: 'Customer interview with Acme Corp discussing product usage, highlighting transcription accuracy, and requesting export and integration features.',
};

/**
 * Generate analysis results for a transcript
 */
function generateDemoAnalysis(transcriptId: string, templateId: string): Omit<Analysis, 'id' | 'createdAt'> {
  const sections: AnalysisSection[] = [
    {
      name: 'Executive Summary',
      content: `This meeting covered strategic planning discussions for the upcoming quarter. Key participants reviewed progress on current initiatives and aligned on priorities for the next phase of work. The team demonstrated strong collaboration and clear communication throughout the session.

The discussion centered on balancing immediate deliverables with longer-term strategic goals. Several important decisions were made regarding resource allocation and timeline adjustments.`,
      evidence: [
        {
          text: 'Let\'s discuss Q1 priorities. I\'ve identified four major initiatives we should consider.',
          start: 180,
          end: 195,
          relevance: 0.95,
        },
        {
          text: 'Given our resources, we can realistically tackle two of these initiatives this quarter.',
          start: 520,
          end: 535,
          relevance: 0.88,
        },
      ],
    },
    {
      name: 'Key Discussion Points',
      content: `1. **Progress Review**: The team reviewed accomplishments from the previous period, noting a 15% increase in customer satisfaction and 8% reduction in churn.

2. **Resource Allocation**: Significant discussion around prioritizing initiatives given limited engineering capacity.

3. **Technical Considerations**: The team evaluated complexity and timeline for proposed features, with particular focus on security compliance requirements.

4. **Market Opportunities**: Analysis of customer feedback and competitive landscape informed priority decisions.`,
      evidence: [
        {
          text: 'Customer satisfaction scores increased by 15% and we reduced churn by 8%.',
          start: 95,
          end: 110,
          relevance: 0.92,
        },
      ],
    },
    {
      name: 'Decisions Made',
      content: `The team reached consensus on the following decisions:

- **Q1 Focus Areas**: Enterprise security features and AI-powered meeting summaries were selected as primary initiatives
- **Timeline Commitments**: SOC 2 compliance work to begin immediately with 3-4 month target
- **Deferred Items**: Integration ecosystem expansion and international expansion moved to Q2 planning`,
      evidence: [
        {
          text: 'I vote for enterprise security and AI summaries. Security unlocks enterprise deals.',
          start: 680,
          end: 700,
          relevance: 0.97,
        },
      ],
    },
  ];

  const actionItems: ActionItem[] = [
    {
      id: generateDemoId('action'),
      task: 'Begin SOC 2 compliance assessment and create implementation roadmap',
      owner: 'Security Team Lead',
      deadline: 'End of Week 1',
      timestamp: 320,
    },
    {
      id: generateDemoId('action'),
      task: 'Set up initial meeting with OpenAI integration team for AI summaries feature',
      owner: 'Product Manager',
      deadline: 'This Friday',
      timestamp: 480,
    },
    {
      id: generateDemoId('action'),
      task: 'Document Q1 priorities and share with all team leads',
      owner: 'Project Manager',
      deadline: 'Tomorrow',
      timestamp: 750,
    },
    {
      id: generateDemoId('action'),
      task: 'Schedule follow-up meeting to review implementation proposals',
      owner: 'Meeting Organizer',
      deadline: 'Within 2 hours',
      timestamp: 810,
    },
  ];

  const decisions: Decision[] = [
    {
      id: generateDemoId('decision'),
      decision: 'Enterprise security features and AI-powered meeting summaries will be the Q1 focus areas',
      timestamp: 700,
      context: 'Voted on by team after evaluating four potential initiatives',
    },
    {
      id: generateDemoId('decision'),
      decision: 'Integration ecosystem and international expansion deferred to Q2',
      timestamp: 720,
      context: 'Due to resource constraints, only two major initiatives can be tackled per quarter',
    },
  ];

  const quotes: Quote[] = [
    {
      text: 'Smaller, more frequent releases work better than big bang launches.',
      speaker: 'Product Lead',
      timestamp: 145,
    },
    {
      text: 'Security unlocks enterprise deals, and AI is our competitive advantage.',
      speaker: 'Team Member',
      timestamp: 695,
    },
  ];

  const results: AnalysisResults = {
    summary: 'Q1 planning meeting focused on prioritizing enterprise security features and AI-powered meeting summaries. Team reviewed last quarter achievements and made strategic decisions about resource allocation.',
    sections,
    actionItems,
    decisions,
    quotes,
  };

  return {
    transcriptId,
    templateId,
    analysisStrategy: 'hybrid',
    results,
    metadata: {
      estimatedDuration: '4-6 min',
      apiCalls: '3-4 calls',
      quality: 'High',
      actualTokens: 12500,
      wasAutoSelected: true,
    },
  };
}

/**
 * Populate segments for transcripts
 */
function prepareTranscript(transcript: Omit<Transcript, 'id'>): Omit<Transcript, 'id'> {
  return {
    ...transcript,
    segments: generateSegments(transcript.text, transcript.metadata.duration),
  };
}

/**
 * Complete demo data set ready for loading
 */
export interface DemoDataSet {
  transcripts: Array<Omit<Transcript, 'id'> & { id: string }>;
  analyses: Array<Omit<Analysis, 'id' | 'createdAt'> & { id: string; createdAt: Date }>;
}

/**
 * Generate complete demo data set with IDs
 */
export function generateDemoData(): DemoDataSet {
  const now = new Date();

  // Generate IDs for transcripts
  const transcript1Id = generateDemoId('transcript');
  const transcript2Id = generateDemoId('transcript');
  const transcript3Id = generateDemoId('transcript');

  // Prepare transcripts with IDs and segments
  const transcripts = [
    { id: transcript1Id, ...prepareTranscript(demoTranscript1) },
    { id: transcript2Id, ...prepareTranscript(demoTranscript2) },
    { id: transcript3Id, ...prepareTranscript(demoTranscript3) },
  ];

  // Generate analyses for some transcripts
  const analyses = [
    {
      id: generateDemoId('analysis'),
      createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      ...generateDemoAnalysis(transcript2Id, 'meeting-notes'),
    },
    {
      id: generateDemoId('analysis'),
      createdAt: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000), // 13 days ago
      ...generateDemoAnalysis(transcript3Id, 'interview-summary'),
    },
  ];

  return { transcripts, analyses };
}

/**
 * Demo data metadata for display
 */
export const DEMO_DATA_INFO = {
  transcriptCount: 3,
  analysisCount: 2,
  description: 'Sample transcripts including a team standup, planning meeting, and customer interview with pre-generated analyses.',
};
