import { bocciaRuleSections } from '../../game/sports/boccia/bocciaRules';

export function BocciaRulesPage(): string {
  return `
    <section class="rules-page" aria-labelledby="boccia-rules-title">
      <p class="eyebrow">Boccia rules</p>
      <h1 id="boccia-rules-title">Simplified arcade rules</h1>
      <p class="game-shell__rules-note">This is a simplified arcade version designed to teach the core idea of Boccia. It is not a full simulation of official Boccia rules.</p>
      <div class="section-heading__actions">
        <a class="button button--primary" href="/sports/boccia/">Play Boccia</a>
        <a class="button button--icon" href="/sports/">Back to sports</a>
      </div>
      <div class="game-shell__rules-grid rules-page__grid">
        ${bocciaRuleSections
          .map(
            (section) => `
              <article class="game-shell__rule-section" aria-labelledby="boccia-rule-${section.id}">
                <h2 id="boccia-rule-${section.id}">${section.title}</h2>
                ${section.body.map((paragraph) => `<p>${paragraph}</p>`).join('')}
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}
