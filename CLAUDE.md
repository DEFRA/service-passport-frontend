# Service Passport front end

Context for Claude Code. Keep this file in the repo root.

## What this is

The Service Passport makes Defra's governance route to live visible for a service, and helps delivery leads navigate it. It's built by the AI Capability and Enablement (AICE) team on the Core Delivery Platform (CDP). The first users are EU Reset teams.

- It changes no approval and no review, and it is not a way to skip assurance.
- The passport never decides anything. AI suggests, the delivery lead confirms, the gate owner decides.

## The MVP shape: wide and thin

- **Wide:** the whole route for every service, built on the DDTS Portfolio Hub lifecycle.
  - Agile: discovery, alpha, private beta, public beta.
  - Waterfall: startup and feasibility; initiation, scoping and define; design, build and test; implementation.
  - The same five stage gates in both:
    1. Business justification
    2. Delivery strategy
    3. Investment decision
    4. Service readiness
    5. Closure
  - Service assessments apply to agile only.
- **Thin:** the full experience for one slice, the Service Design Pack (service readiness, leading to gate 4). The gate 4 pack is a demo with example data.

## v0 screens (in this order)

1. **Describe your service.** A few questions that tailor the route:
   - agile or waterfall
   - does it use AI
   - CDP only, or connects to another platform
   - target go-live date

   Ask again when the service changes.
2. **Programme view.** For senior leaders: every service or journey, its current phase and gate, and what's at risk against go-live. One service can be several journeys, delivered by different suppliers.
3. **Your route.** The whole route for one service, showing phases, gates and steps, each with its owner and typical wait. Long waits are flagged early:
   - service design approval: about 12 weeks
   - pen test notice: 6 to 8 weeks
   - accessibility audit: book 6 to 8 weeks ahead
   - service assessment booking: 6 to 8 weeks
   - change request: about 10 days
4. **What's left before go-live.** For teams already partway through.
5. **Service Design Pack slice.**
   - its sections and onboarding items
   - status per item
   - a link to where each piece of evidence lives
   - who owns each
6. **Update a stamp.** One question to record what the gate owner decided.

Not in v0:
- AI
- integrations
- writing to any other system
- document storage
- sign-in beyond what CDP gives an internal service

## Hard rules

- **This repo is public.** Use example data only:
  - no real EU Reset service names
  - no people's names or contact details
  - nothing marked OFFICIAL-SENSITIVE
  - no secrets
- **Data:** keep it in JSON files under `src/server/data/` for now. Shape it so a back end API (Node, MongoDB) can replace it later.
  - Entities: service, journey, phase, gate, step, stamp.
- **Stack:** Node.js, Hapi, GOV.UK Frontend Nunjucks templates and vanilla JavaScript.
  - No React, Vue or other frontend frameworks.
  - Follow the CDP Node front end template's structure.
- **Patterns:** use the GOV.UK Design System first:
  - question pages (one thing per page), back link, error summary and messages, check answers
  - task list, summary list, step-by-step, warning text, tags, phase banner
- **Accessibility:** WCAG 2.2 AA. Check keyboard, focus, zoom to 200% and screen readers, not just automated tests.
- **Branding:**
  - Defra header and logo, not the GOV.UK crown.
  - Buttons and confirmation panels in GOV.UK green (#00703C).
  - Defra green (#00A33B) only as the header line or a thin accent, never under small white text.
  - Blue only for links.
  - No orange or amber, no purple text, and no coloured left-edge accent bars on cards.
- **Phase banner:** show an "Alpha" phase banner so nobody mistakes it for a live service.

## Content rules

- Plain English, sentence case.
- No em dashes. Use a comma, colon or full stop.
- Expand acronyms on first use (except CDP once the user has seen it).
- Say "people", not "users". Say "delivery lead" or "product lead", never just "lead".
- Negative contractions written out ("cannot", "do not").
- Button text: "Continue", not "Next". No "please" and no "sorry" in errors.
- Label AI content clearly when AI arrives later. Never give it a persona.
- Keep microcopy minimal. Let the screens do the talking.

## How we work

- Branch, pull request, review, merge. On CDP, merging to main triggers the build. Check which environment is safe before showing it to anyone.
- Keep decision records in `docs/decisions/`, and only write things that would be fine in public.
- Tasks live in Jira, in the AICE-Service Passport space (key ASP).
