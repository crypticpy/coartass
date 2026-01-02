import type { TourConfig } from './types';

export const recordTour: TourConfig = {
  id: 'record',
  name: 'How to Record Audio',
  description: 'Learn how to record meetings directly in the app',
  steps: [
    {
      id: 'record-nav',
      target: 'nav-record',
      title: 'Go to Recording',
      content: 'Click here to access the recording page where you can capture audio directly from your microphone or system.',
      placement: 'bottom',
      route: '/',
    },
    {
      id: 'record-mode',
      target: 'record-mode-selector',
      title: 'Choose Recording Mode',
      content: 'Select how you want to record: Microphone captures your voice, System Audio captures computer sounds, Commentary records both together.',
      placement: 'bottom',
      route: '/record',
    },
    {
      id: 'record-start',
      target: 'record-start-button',
      title: 'Start Recording',
      content: 'Click this button to begin recording. Your browser will request microphone permission if not already granted.',
      placement: 'top',
      route: '/record',
    },
    {
      id: 'record-during',
      target: 'record-start-button',
      title: 'During Recording',
      content: 'While recording, controls will appear to pause, resume, or stop. A timer shows the current recording length.',
      placement: 'top',
      route: '/record',
    },
    {
      id: 'record-after',
      target: 'nav-recordings',
      title: 'After Recording',
      content: 'When you stop recording, you can preview and save it. Saved recordings appear in the Recordings section, ready for transcription.',
      placement: 'bottom',
      route: '/record',
    },
  ],
};
