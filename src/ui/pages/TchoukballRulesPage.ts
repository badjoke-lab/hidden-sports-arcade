import { tchoukballRuleSections, tchoukballRulesNotice } from '../../game/sports/tchoukball/tchoukballRules';

export function TchoukballRulesPage(): string {
  return `
    <section class="rules-page" aria-labelledby="tchoukball-rules-title">
      <p class="eyebrow">Tchoukball rules</p>
      <h1 id="tchoukball-rules-title">Simplified arcade rules</h1>
      <p class="game-shell__rules-note">${tchoukballRulesNotice}</p>
      <div class="section-heading__actions">
        <a class="button button--primary" href="/sports/tchoukball/">Play Tchoukball</a>
        <a class="button button--icon" href="/sports/">Back to sports</a>
      </div>
      <div class="game-shell__rules-grid rules-page__grid">
        ${tchoukballRuleSections
          .map(
            (section) => `
              <article class="game-shell__rule-section" aria-labelledby="tchoukball-rule-${section.id}">
                <h2 id="tchoukball-rule-${section.id}">${section.title}</h2>
                ${section.body.map((paragraph) => `<p>${paragraph}</p>`).join('')}
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}
