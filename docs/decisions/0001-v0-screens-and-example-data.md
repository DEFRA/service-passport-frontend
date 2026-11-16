# 1. v0 screens and example data

Date: 12 November 2026

## Status

Superseded, 16 November 2026. The v0 screens below were replaced by one delivery lead's journey with one example service, taken from the Mural board: start page, describe the service, check the AI suggestions, the route, the passport, each step, and ready for release. The programme view, the route catalogue and the Service Design Pack screens were removed.

## Context

The first version has to show the whole route for every service and do the Service Design Pack slice fully, using example data only, in time to show the service transition team.

## Decisions

- **The passport page is the hub.** It shows what to book next, what is left before go-live, and links to the whole route and the Service Design Pack. "Your route" and "What's left" share one task list template in two states, rather than being two screens.
- **One passport per service, with journey scope on steps.** A service can have several journeys delivered by different suppliers. Steps that happen per journey (IT health check, accessibility audit, change request) get one stamp per journey. The programme view shows journey rows under their service.
- **The route is data.** The route catalogue in `src/server/data/route-catalogue.json` holds phases, gates and steps with owners, waits and the tailoring rules that add or remove a step. Changing the route needs no code.
- **Six tailoring questions.** Agile or waterfall, third-party suppliers, AI, platform, size of change and go-live date. Suppliers is asked because gate 2 only applies with them.
- **Risk is a simple rule.** Each long wait in the run-up to gate 4 gets a start by date, worked back from go-live. A step is late, shown as a red "Start now" tag, once that date has passed and nothing has started. A service is "At risk" when any step is late. Red is used for this and for "Not approved", nothing else. Otherwise the programme view says "None flagged", never "On track".
- **Statuses differ by kind.** A step can be not started, in progress, booked, submitted, approved, approved with conditions or not approved. A pack item can be not started, in progress or done. Updating either is one question. Conditions are only asked for when needed. Evidence links are added on their own question page.
- **A shared password gates the alpha** when `PASSPORT_PASSWORD` is set. It is a stop-gap until Defra sign-in through CDP is in place.
- **Changes live in memory** until the service restarts. The data shapes match what a Node and MongoDB back end will return, so the handlers can swap to it without changing the screens.

## Consequences

- Everything a person changes is lost on restart. Fine for a demo, not for a pilot.
- The Service Design Pack items are invented from the structure of the real pack. Replace them with the real item names, with owners as roles, before showing the pack to the service transition team.
