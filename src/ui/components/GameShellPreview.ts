export function GameShellPreview(): string {
  return `
    <section class="game-shell" aria-labelledby="game-shell-title">
      <div class="section-heading section-heading--split">
        <div>
          <p class="eyebrow">Game shell section</p>
          <h2 id="game-shell-title">Boccia preview shell</h2>
        </div>
        <p class="section-heading__note">Gameplay starts in a later PR</p>
      </div>

      <dl class="game-shell__meta" aria-label="Current shell details">
        <div>
          <dt>Mode</dt>
          <dd>VS CPU</dd>
        </div>
        <div>
          <dt>Sport</dt>
          <dd>Boccia</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>Shell only</dd>
        </div>
        <div>
          <dt>Note</dt>
          <dd>Gameplay starts in a later PR</dd>
        </div>
      </dl>

      <div class="game-shell__frame">
        <div id="game-root" class="game-shell__canvas" aria-label="Hidden Sports Arcade Phaser shell canvas"></div>
      </div>
    </section>
  `;
}
