import type { Sport } from '../../data/sports';
import { Hero } from '../components/Hero';
import { SportCard } from '../components/SportCard';

export function HomePage(sports: Sport[]): string {
  const playableSports = sports.filter((sport) => sport.status === 'active' || sport.status === 'foundation');
  const comingSoonSports = sports.filter((sport) => sport.status === 'coming-soon');

  return `
    ${Hero()}
    <section class="page-panel" aria-labelledby="project-title">
      <p class="eyebrow">Project</p>
      <h2 id="project-title">Tiny route-based games for overlooked sports</h2>
      <p>Hidden Sports Arcade teaches one sport at a time with a dedicated page, dedicated controls, and dedicated rules so each preview stays clear.</p>
      <div class="section-heading__actions">
        <a class="button button--primary" href="/sports/">Browse all sports</a>
      </div>
    </section>
    <section class="sports sports--compact" aria-labelledby="playable-title">
      <div class="section-heading section-heading--split">
        <div>
          <p class="eyebrow">Playable sports</p>
          <h2 id="playable-title">Play or preview now</h2>
        </div>
        <p class="section-heading__note">Each sport opens on its own route.</p>
      </div>
      <div class="sports__grid">
        ${playableSports.map((sport) => SportCard(sport)).join('')}
      </div>
    </section>
    <section class="sports sports--compact" aria-labelledby="soon-title">
      <div class="section-heading section-heading--split">
        <div>
          <p class="eyebrow">Coming soon</p>
          <h2 id="soon-title">Queued sports</h2>
        </div>
        <p class="section-heading__note">No new sports were added in this routing pass.</p>
      </div>
      <div class="sports__grid">
        ${comingSoonSports.map((sport) => SportCard(sport)).join('')}
      </div>
    </section>
  `;
}
