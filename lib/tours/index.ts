export type { TourStep, TourConfig } from './types';

export { uploadTour } from './upload-tour';
export { recordTour } from './record-tour';
export { transcriptsTour } from './transcripts-tour';
export { analysisTour } from './analysis-tour';
export { templatesTour } from './templates-tour';

import { uploadTour } from './upload-tour';
import { recordTour } from './record-tour';
import { transcriptsTour } from './transcripts-tour';
import { analysisTour } from './analysis-tour';
import { templatesTour } from './templates-tour';
import type { TourConfig } from './types';

/** All available tours */
export const allTours: TourConfig[] = [
  uploadTour,
  recordTour,
  transcriptsTour,
  analysisTour,
  templatesTour,
];

/** Get a tour by ID */
export function getTourById(id: string): TourConfig | undefined {
  return allTours.find(tour => tour.id === id);
}
