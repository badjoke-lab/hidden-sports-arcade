const navItems = [
  ['Home', '/'],
  ['Sports', '/sports/'],
  ['About', '/#about'],
  ['Settings', '/#settings'],
] as const;

export function Header(): string {
  return `
    <header class="site-header">
      <a class="site-header__brand" href="/" aria-label="Hidden Sports Arcade home">
        <span class="site-header__mark" aria-hidden="true">HSA</span>
        <span>
          <span class="site-header__name">Hidden Sports Arcade</span>
          <span class="site-header__tagline">Tiny games for overlooked sports</span>
        </span>
      </a>
      <nav class="site-header__nav" aria-label="Primary navigation">
        ${navItems
          .map(
            ([item, href]) => `
              <a class="site-header__link" href="${href}">${item}</a>
            `,
          )
          .join('')}
      </nav>
    </header>
  `;
}
