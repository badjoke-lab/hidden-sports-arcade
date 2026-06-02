import type { Sport } from '../../data/sports';
import { SportsGrid } from '../components/SportsGrid';

export function SportsPage(sports: Sport[]): string {
  return `
    <section class="page-panel" aria-labelledby="sports-page-title">
      <p class="eyebrow">Sports</p>
      <h1 id="sports-page-title">Choose a sport</h1>
      <p>Open a dedicated game page or read the dedicated rules page. Coming soon sports stay disabled until their own route exists.</p>
    </section>
    ${SportsGrid(sports)}
  `;
}
