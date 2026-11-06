import { OFFLINE_CAP_HOURS } from './data';
import { fmtDuration } from './formulas';
/** The line under the Home card's offline max stage: how long away it takes to get there. */
export function offlineNote(autoAdvance: boolean, max: { stage: number; seconds: number; outOfTime: boolean }, stage: number): string {
  if (!autoAdvance) return 'Auto-advance is off';
  if (max.stage <= stage) return 'Your team is at its wall: level up to push';
  if (max.outOfTime) return `After ${OFFLINE_CAP_HOURS}h away (still climbing)`;
  return `Reached in ${fmtDuration(Math.max(60, Math.ceil(max.seconds / 60) * 60))} away`;
}
