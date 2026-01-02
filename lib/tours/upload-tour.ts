import type { TourConfig } from './types';

export const uploadTour: TourConfig = {
  id: 'upload',
  name: 'How to Upload & Transcribe',
  description: 'Learn how to upload audio files and get transcriptions',
  steps: [
    {
      id: 'upload-nav',
      target: 'nav-upload',
      title: 'Navigate to Upload',
      content: 'Click here to go to the upload page where you can submit audio files for transcription.',
      placement: 'bottom',
      route: '/',
    },
    {
      id: 'upload-zone',
      target: 'upload-zone',
      title: 'Upload Your File',
      content: 'Drag and drop an audio file here, or click to browse. Supported formats include MP3, MP4, M4A, WAV, WebM, and more. Files over 25MB are automatically converted.',
      placement: 'bottom',
      route: '/upload',
    },
    {
      id: 'upload-next-steps',
      target: 'upload-zone',
      title: 'After File Selection',
      content: 'Once you select a file, additional settings will appear: Department assignment, Speaker Detection toggle, Language selection, and a Start Transcription button.',
      placement: 'bottom',
      route: '/upload',
    },
    {
      id: 'upload-complete',
      target: 'nav-transcripts',
      title: 'View Your Transcripts',
      content: 'After transcription completes (typically 1-3 minutes), you\'ll be redirected to the transcript. You can also find all transcripts here in the Transcripts section.',
      placement: 'bottom',
      route: '/upload',
    },
  ],
};
