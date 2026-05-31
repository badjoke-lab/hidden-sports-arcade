# Hidden Sports Arcade v0.1 Specification

## Product summary

Hidden Sports Arcade is a lightweight browser arcade for simplified versions of hidden and lesser-known sports. The site should be easy to host as static files, approachable on desktop and mobile browsers, and structured so new sports can be added over time without introducing backend services.

## v0.1 scope

The v0.1 release establishes the technical foundation only. It should prove that the static app shell, sports list, and Phaser runtime can load successfully. It must not include full Boccia gameplay or any other complete sport simulation.

## Goals

- Create a static-site friendly Vite, TypeScript, and Phaser project.
- Render a dark arcade-inspired landing page for Hidden Sports Arcade.
- Display an extensible sports list with one active Boccia card and several coming-soon sports.
- Initialize a minimal Phaser canvas that confirms the game shell is ready.
- Keep the codebase small, readable, and ready for future game scenes and routes.

## Non-goals

- No backend server.
- No database.
- No authentication.
- No paid services.
- No online multiplayer.
- No paid or externally licensed asset pack dependency.
- No actual Boccia gameplay implementation in v0.1.

## Technical stack

- Vite for local development and static production builds.
- TypeScript for application code.
- Phaser for the game canvas and future arcade gameplay scenes.
- Plain HTML and CSS for the static shell and UI.

## Information architecture

The initial app should include:

- A top-level header with the title `Hidden Sports Arcade`.
- A short concept description explaining the hidden sports arcade idea.
- A Phaser game canvas section.
- A sports list section.

## Sports catalog

### Active shell sport

- Boccia
  - Tags: Target, Precision, Paralympic Sport
  - Actions: Play, Rules
  - The actions can be placeholders in v0.1, but the markup should be ready for future routing or view logic.

### Coming soon sports

- Tchoukball
- Goalball
- Kabaddi
- Molkky

## Phaser shell requirements

The Phaser scene should be intentionally minimal and should only demonstrate that Phaser initializes. It may render:

- A dark game panel.
- The text `Game shell ready`.
- A simple shape such as a rectangle or circle.

## Design guidelines

- Dark arcade-like visual direction.
- Clean cards and panels.
- Responsive layout that remains readable on mobile devices.
- Avoid over-designed visuals that would make future sports harder to add.
- Prefer reusable data structures and UI functions.

## Acceptance criteria

- `npm install` works.
- `npm run dev` starts the local Vite development server.
- `npm run build` succeeds.
- `npm run typecheck` succeeds.
- The top page renders.
- Sports cards render.
- Phaser canvas initializes.
- No backend is required.
- No paid services are required.
- No online multiplayer exists.
- No Boccia gameplay exists yet.
