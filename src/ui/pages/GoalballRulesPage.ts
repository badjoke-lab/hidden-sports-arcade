import { goalballRuleSections, goalballRulesNotice } from '../../game/sports/goalball/goalballRules';

export function GoalballRulesPage(): string {
  return `
    <section class="rules-page" aria-labelledby="goalball-rules-title">
      <p class="eyebrow">Goalball rules</p>
      <h1 id="goalball-rules-title">Simplified arcade rules</h1>
      <p class="game-shell__rules-note">${goalballRulesNotice}</p>
      <div class="section-heading__actions">
        <a class="button button--primary" href="/sports/goalball/">Play Goalball</a>
        <a class="button button--icon" href="/sports/">Back to sports</a>
      </div>
      <div class="game-shell__rules-grid rules-page__grid">
        ${goalballRuleSections
          .map(
            (section) => `
              <article class="game-shell__rule-section" aria-labelledby="goalball-rule-${section.id}">
                <h2 id="goalball-rule-${section.id}">${section.title}</h2>
                ${section.body.map((paragraph) => `<p>${paragraph}</p>`).join('')}
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}
