# Live Broadcast Audit Method

This document defines a public-safe method for researching official live broadcast and replay availability across racing jurisdictions and racing types.

## Purpose

The audit exists to identify whether a jurisdiction or racing type has official, link-first access to live broadcasts or race replays. It is designed for research and navigation only.

The audit must not republish race video, embed video players, copy full racecards, collect betting products, or present odds, entries, results, payouts, or wagering recommendations.

## Source standards

Use only sources that are official or clearly official-partner sources, such as:

- Racing authority, regulator, federation, or commission websites.
- Racecourse, race club, or event organizer websites.
- Official broadcaster, rights-holder, or streaming partner websites.
- Official social channels when the account is verifiably controlled by the authority, event, racecourse, or broadcast partner.

Do not treat unofficial mirrors, reposted videos, scraped streams, or unverified social uploads as usable sources. If they are encountered during research, mark them as `unsafe_unofficial` and do not display them as a viewing option.

## Classification workflow

1. Identify the jurisdiction, country or region, and racing types in scope.
2. Find official or clearly official-partner pages that describe live viewing, broadcast partners, replay archives, or racecourse-only viewing.
3. Record only link-level references to official pages; do not copy or embed video.
4. Assign separate live and replay status values from the approved status definitions.
5. Record access requirements using boolean fields for login, betting account, and paid TV requirements.
6. Record any stated geographic restriction in neutral wording.
7. Add concise notes that explain uncertainty without promotional language.
8. Set confidence according to the quality and clarity of the official evidence.
9. Set `last_checked` to the date the evidence was reviewed.

## Approved status values

The allowed status values are maintained in `data/static/live-broadcast-statuses.json` and are summarized here:

- `official_free`
- `official_account`
- `betting_account`
- `tv_pay`
- `broadcast_partner`
- `replay_available`
- `social_stream`
- `racecourse_only`
- `event_only`
- `geo_restricted`
- `not_verified`
- `none_found`
- `archive_only`
- `unsafe_unofficial`

## Coverage record requirements

Each coverage record should use the fields defined in `data/static/live-broadcast-coverage.json`:

- `jurisdiction_id`
- `country_or_region`
- `racing_types`
- `live_status`
- `replay_status`
- `provider_name`
- `official_live_url`
- `official_replay_url`
- `requires_login`
- `requires_betting_account`
- `requires_paid_tv`
- `geo_restriction`
- `source_type`
- `evidence_urls`
- `confidence`
- `last_checked`
- `notes`

## Confidence levels

Use the following confidence values:

- `high`: Current official or official-partner evidence clearly describes access and restrictions.
- `medium`: Official evidence exists, but access details are partial, dated, or split across multiple official pages.
- `low`: Only limited official evidence is available, or wording is ambiguous.
- `not_verified`: No suitable official or official-partner evidence has been confirmed.

## Public-safe handling rules

- Keep the project link-first: point to official pages instead of hosting or embedding media.
- Do not republish race video, full racecards, entries, odds, results, payouts, or wagering content.
- Do not present unofficial streams as usable sources.
- Keep notes factual, neutral, and limited to access availability.
- Prefer `not_verified` when official evidence is unclear.
- Use `none_found` only after checking plausible official and official-partner sources.
