import type { ProgressState } from '../../progress/types';
import type { Sport } from '../../data/sports';
import { getProgressState } from '../../progress/progressManager';
import { SportCard } from './SportCard';

function sportNameById(sports: Sport[], sportId: string | undefined): string {
  if (!sportId) {
    return 'None yet';
  }

  return sports.find((sport) => sport.id === sportId)?.name ?? sportId;
}

function renderProgressOverview(sports: Sport[], progress: ProgressState): string {
  const recentLabel = sportNameById(sports, progress.recentSports[0]);

  return `
    <div class="sports__progress-summary" aria-live="polite">
      <span>Favorites: <strong data-progress-favorite-count>${progress.favorites.length}</strong></span>
      <span>Recently played: <strong data-progress-recent-home>${recentLabel}</strong></span>
    </div>
  `;
}

export function SportsGrid(sports: Sport[]): string {
  const progress = getProgressState();

  return `
    <section id="sports" class="sports" aria-labelledby="sports-title">
      <div class="section-heading section-heading--split">
        <div>
          <p class="eyebrow">Sports list</p>
          <h2 id="sports-title">Choose a sport</h2>
        </div>
        <p class="section-heading__note">One active shell now, more rulebooks queued next.</p>
      </div>
      ${renderProgressOverview(sports, progress)}
      <div class="sports__grid">
        ${sports.map(SportCard).join('')}
      </div>
    </section>
  `;
}
