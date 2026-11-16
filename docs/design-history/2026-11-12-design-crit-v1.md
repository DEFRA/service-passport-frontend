# Design crit of the v0 screens, v1

Date: 12 November 2026

A crit of the first build against the brief in CLAUDE.md. Each finding says what was wrong, why it matters and what changed.

## The assumptions, interrogated

| Assumption in the first build | Verdict | Why |
| --- | --- | --- |
| A wait shown as a duration ("6 to 8 weeks") is enough | Wrong | A delivery lead plans in dates. The brief says flag long waits early, and a duration only becomes a flag once it is already late. Each long wait now shows a "start by" date, worked back from go-live. |
| Everything left on the route is "before go-live" | Wrong | Closure, gate 5 and the live assessment happen after go-live. Counting them made the list longer and could flag a service at risk for work it does after launch. |
| "On track" is a fair label for a service with no flags | Wrong | The passport only knows about waits against dates. "On track" claims a judgement it cannot make, and the passport never decides anything. It now says "None flagged". |
| Tailoring can live behind a link | Wrong | The brief calls tailoring a headline feature and says to ask again as services grow. The passport now shows the answers the route is built from, with a change link. |
| One status list fits steps and pack items | Wrong | "What did the gate owner decide?" made no sense for a runbook, and "Approved" made no sense for a pack item. Steps and pack items now have their own statuses and their own question. |
| Evidence links can be shown without a way to add them | Wrong | The brief asks for a link to where each piece of evidence lives. There was no way to add one. There is now a question page for it, reached from the summary list. |
| Blue and light blue tags are fine because GOV.UK uses them | Wrong for this service | The brand rule is blue only for links. Tags now use grey (not started), green (moving), red (late or not approved) and plain text once done, which also follows GOV.UK task list guidance that finished work should recede. |
| A green navigation bar matches the team's other front end | Wrong here | It held one link, put small white text on Defra green, and repeated the service name link. It is gone. A thin Defra green line sits under the header instead. |
| The programme view is for whoever adds services | Wrong | It is for senior leaders asking "where are we?". The green "Add a service" button was the loudest thing on the page. It is now a secondary button, and the table is sorted by go-live date. |
| Journeys pass gates | Wrong | Gates are per service. The gate column for journeys showed the supplier name. The supplier now sits under the journey name and the gate cell is empty. |
| The next thing to do is whatever has the longest wait | Wrong | For a service in discovery that pointed at service design approval, nine months out. The passport now leads with anything late, then a start by date in the next three months, then the open work in the current phase. |
| Question pages can drop the phase banner | Wrong | The brief says nobody should mistake this for a live service. The banner now shows on every page, with no breadcrumbs next to a back link. |
| A task list is the right pattern for the route | Right | The brief also names step-by-step navigation, but a step-by-step has no status. The route needs status on every step. |
| One page per question in the describe flow | Right | Each answer changes the route, and the hint says how. |

## Smaller fixes

- "Next: it health check": a lowercase filter broke the acronym. Sentences no longer change the case of step names.
- The footer linked to the GOV.UK accessibility statement, which is not this service's. Removed until this service has one, which it needs before public beta.
- The programme table forced a horizontal page scroll on a phone. Phase and gate now share a column, and on a phone the table scrolls inside its own region.
- The example data showed a live service with an empty Service Design Pack. The live and late services now have pack items that match the gates they have passed.
- Two Defra greens were in use. There is now one, #00A33B, for the header line, the footer rule and the service name.
- The warning icon showed on every passport, at risk or not. It now only shows when something is late.
- The route page intro explained the page. Cut to a count.
- "Update the stamp" saved and went back, so the button now says "Save".

## Open questions

- **Size of the change.** We ask it and it changes nothing. Either the route owners give us a rule, or the question goes.
- **What a "start by" date is anchored to.** It is worked back from go-live. For the run-up to gate 4 and release that is close enough. For discovery and alpha work it is not, so those steps show their typical wait instead. Gate dates would fix this.
- **Two lanes.** The catalogue knows whether a step is project governance or service assurance. The screens do not show it yet. Worth testing with the service transition team.
