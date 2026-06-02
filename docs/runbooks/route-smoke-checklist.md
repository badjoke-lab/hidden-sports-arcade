# Route smoke checklist: no-white-screen hardening

Use this checklist after building or deploying the app to confirm route navigation renders visible content instead of a blank page.

## Desktop route navigation

- [ ] Open `/`.
- [ ] Click Boccia from the homepage.
- [ ] Return to `/`, then click Tchoukball from the homepage.
- [ ] Open `/sports/`.
- [ ] Click Play Boccia.
- [ ] Return to `/sports/`, then click Preview Tchoukball.
- [ ] Use browser Back and Forward between Home, Sports, Boccia, and Tchoukball.
- [ ] Confirm no blank page appears during any transition.

## Direct URL access

- [ ] Directly open `/sports/boccia/`.
- [ ] Directly open `/sports/tchoukball/`.
- [ ] Directly open `/sports/boccia/rules/`.
- [ ] Directly open `/sports/tchoukball/rules/`.
- [ ] Confirm every route renders the expected visible page shell.

## Error fallback

- [ ] Force or simulate a game startup failure.
- [ ] Confirm the sport page shell remains visible.
- [ ] Confirm the game area shows `Game failed to start.`.
- [ ] Confirm the message includes the sport name.
- [ ] Confirm the fallback includes `Try reloading this page.` and `Back to sports`.
- [ ] Confirm detailed error information is logged to the console, not printed as a stack trace in the UI.

## Mobile route rendering

- [ ] Set the viewport to 360px wide.
- [ ] Open `/`.
- [ ] Open `/sports/`.
- [ ] Open `/sports/boccia/`.
- [ ] Open `/sports/tchoukball/`.
- [ ] Open both rules pages.
- [ ] Confirm no route renders as a blank page at 360px.
