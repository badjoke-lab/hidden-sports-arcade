const navItems = ['Home', 'Sports', 'About', 'Settings'];

export function Header(): string {
  return `
    <header class="site-header">
      <a class="site-header__brand" href="#home" aria-label="Hidden Sports Arcade home">
        <span class="site-header__mark" aria-hidden="true">HSA</span>
        <span>
          <span class="site-header__name">Hidden Sports Arcade</span>
          <span class="site-header__tagline">Tiny games for overlooked sports</span>
        </span>
      </a>
      <nav class="site-header__nav" aria-label="Primary navigation">
        ${navItems
          .map(
            (item) => `
              <a class="site-header__link" href="#${item.toLowerCase()}" aria-label="${item} placeholder link">${item}</a>
            `,
          )
          .join('')}
      </nav>
    </header>
  `;
}
