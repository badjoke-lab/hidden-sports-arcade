import type { Sport } from '../../data/sports';
import { SportCard } from './SportCard';

export function SportsGrid(sports: Sport[]): string {
  return `
    <section id="sports" class="sports" aria-labelledby="sports-title">
      <div class="section-heading section-heading--split">
        <div>
          <p class="eyebrow">Sports list</p>
          <h2 id="sports-title">Choose a sport</h2>
        </div>
        <p class="section-heading__note">One active shell now, more rulebooks queued next.</p>
      </div>
      <div class="sports__grid">
        ${sports.map(SportCard).join('')}
      </div>
    </section>
  `;
}
