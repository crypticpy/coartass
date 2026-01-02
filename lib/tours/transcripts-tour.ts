import type { TourConfig } from './types';

export const transcriptsTour: TourConfig = {
  id: 'transcripts',
  name: 'View & Search Transcripts',
  description: 'Learn how to navigate and search your transcriptions',
  steps: [
    {
      id: 'transcripts-nav',
      target: 'nav-transcripts',
      title: 'View Transcripts',
      content: 'Click here to see all your transcribed recordings.',
      placement: 'bottom',
      route: '/',
    },
    {
      id: 'transcripts-search',
      target: 'transcripts-search',
      title: 'Search Transcripts',
      content: 'Use this search box to find transcripts by filename, content, or keywords.',
      placement: 'bottom',
      route: '/transcripts',
    },
    {
      id: 'transcripts-sort',
      target: 'transcripts-sort',
      title: 'Sort Your List',
      content: 'Sort transcripts by date, duration, or filename to find what you need quickly.',
      placement: 'bottom',
      route: '/transcripts',
    },
    {
      id: 'transcripts-card',
      target: 'transcript-card',
      title: 'Open a Transcript',
      content: 'Click on any transcript card to view its full content, including timestamps and speaker labels.',
      placement: 'right',
      route: '/transcripts',
    },
    {
      id: 'transcripts-export',
      target: 'transcript-export',
      title: 'Export Options',
      content: 'Export your transcript in various formats: plain text, SRT subtitles, VTT, or JSON.',
      placement: 'left',
      route: '/transcripts',
    },
  ],
};
