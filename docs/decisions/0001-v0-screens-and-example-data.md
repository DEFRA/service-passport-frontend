# 1. v0 screens and example data

Date: 12 November 2026

## Status

Proposed

## Context

The first version has to show the whole route for every service and do the Service Design Pack slice fully, using example data only, in time to show the service transition team.

## Decisions

- **The passport page is the hub.** It shows what to book next, what is left before go-live, and links to the whole route and the Service Design Pack. "Your route" and "What's left" share one task list template in two states, rather than being two screens.
- **One passport per service, with journey scope on steps.** A service can have several journeys delivered by different suppliers. Steps that happen per journey (IT health check, accessibility audit, change request) get one stamp per journey. The programme view shows journey rows under their service.
- **The route is data.** The route catalogue in `src/server/data/route-catalogue.json` holds phases, gates and steps with owners, waits and the tailoring rules that add or remove a step. Changing the route needs no code.
- **Six tailoring questions.** Agile or waterfall, third-party suppliers, AI, platform, size of change and go-live date. Suppliers is asked because gate 2 only applies with them.
- **Risk is a simple rule.** A step is flagged "Book now" when its typical wait is longer than the time left before go-live and nothing has been booked. A service is "At risk" when any step is. The red GOV.UK tag is used for this, and only this.
- **Stamp statuses** are not started, in progress, booked, submitted, approved, approved with conditions, not approved and done. Updating one is a single question. Conditions are only asked for when needed.
- **A shared password gates the alpha** when `PASSPORT_PASSWORD` is set. It is a stop-gap until Defra sign-in through CDP is in place.
- **Changes live in memory** until the service restarts. The data shapes match what a Node and MongoDB back end will return, so the handlers can swap to it without changing the screens.

## Consequences

- Everything a person changes is lost on restart. Fine for a demo, not for a pilot.
- The Service Design Pack items are invented from the structure of the real pack. Replace them with the real item names, with owners as roles, before showing the pack to the service transition team.
