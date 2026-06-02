import type { Sport } from '../../data/sports';
import { isFavorite } from '../../progress/progressManager';

function renderTags(tags: string[]): string {
  return tags.map((tag) => `<span class="sport-card__tag">${tag}</span>`).join('');
}

function formatStatus(status: Sport['status']): string {
  if (status === 'active') {
    return 'Active';
  }

  if (status === 'foundation') {
    return 'Foundation';
  }

  return 'Coming soon';
}

function formatDifficulty(difficulty: Sport['difficulty']): string {
  return difficulty[0].toUpperCase() + difficulty.slice(1);
}

export function SportCard(sport: Sport): string {
  const isActive = sport.status === 'active';
  const isFoundation = sport.status === 'foundation';
  const hasPreview = isActive || isFoundation;
  const playLabel = isActive ? `Play ${sport.name}` : isFoundation ? `Preview ${sport.name} foundation` : `${sport.name} play mode coming soon`;
  const rulesLabel = hasPreview ? `Read ${sport.name} rules` : `${sport.name} rules coming soon`;
  const favorite = isFavorite(sport.id);
  const favoriteLabel = favorite ? `Remove ${sport.name} from favorites` : `Save ${sport.name} as a favorite`;

  return `
    <article class="sport-card ${isActive ? 'sport-card--active' : isFoundation ? 'sport-card--foundation' : 'sport-card--soon'}" aria-labelledby="sport-${sport.id}-title">
      <div class="sport-card__header">
        <div>
          <p class="sport-card__kicker">${sport.shortName ?? sport.name}</p>
          <h3 id="sport-${sport.id}-title">${sport.name}</h3>
        </div>
        <span class="sport-card__status" aria-label="Status: ${formatStatus(sport.status)}">${formatStatus(sport.status)}</span>
      </div>

      <p class="sport-card__summary">${sport.summary}</p>

      <dl class="sport-card__facts" aria-label="${sport.name} quick facts">
        <div>
          <dt>Length</dt>
          <dd>${sport.matchLength}</dd>
        </div>
        <div>
          <dt>Difficulty</dt>
          <dd>${formatDifficulty(sport.difficulty)}</dd>
        </div>
      </dl>

      <div class="sport-card__tags" aria-label="${sport.name} tags">
        ${renderTags(sport.tags)}
      </div>

      <div class="sport-card__actions" aria-label="${sport.name} actions">
        <button class="button button--primary" type="button" data-action="play" data-sport="${sport.id}" aria-label="${playLabel}" ${hasPreview ? '' : 'disabled'}>
          ${isActive ? 'Play' : isFoundation ? 'Preview' : 'Soon'}
        </button>
        <button class="button button--secondary" type="button" data-action="rules" data-sport="${sport.id}" aria-label="${rulesLabel}" ${hasPreview ? '' : 'disabled'}>
          Rules
        </button>
        <button class="button button--icon sport-card__favorite ${favorite ? 'sport-card__favorite--active' : ''}" type="button" data-action="favorite" data-sport="${sport.id}" aria-label="${favoriteLabel}" aria-pressed="${favorite}">
          <span data-favorite-icon aria-hidden="true">${favorite ? '♥' : '♡'}</span>
          <span data-favorite-label>${favorite ? 'Favorited' : 'Favorite'}</span>
        </button>
      </div>
    </article>
  `;
}
