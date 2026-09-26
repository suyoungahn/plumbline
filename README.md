# Plumbline

An agent-first campaign operating system for a retail media agency. PM case study
prototype.

A campaign manager runs 24 campaigns across 6 Canadian advertisers, in Canadian
dollars. Plans spend across four channels: retailer websites, retailer app ad slots,
off-app publishers bought direct (Taboola, The Globe and Mail, The New York Times,
La Presse) and programmatic (The Trade Desk, DV360).
Three of them need a human today. The other 21 were evaluated and cleared without
one, for a fraction of a cent. That ratio is the product.

Decisions come from **Jev**, a decision model that returns typed answers over a
closed set with calibrated probabilities and cannot generate text. A generative
model writes the prose and is never allowed to choose. Every decision on screen is
badged with its provenance.

## The campaign flow

One campaign, start to finish, driven by the fields you fill in:

1. **Plan**: the brief and every line item (channel, partner, tactic, targeting, KPI,
   buy type, rate, budget). Jev checks while you type whether the retail, in-app and
   publisher lines can actually be delivered against the inventory that exists, and
   the French-creative gate blocks anything that cannot run in Quebec.
2. **Flowchart**: weekly weights and retail moments spread each line across the flight.
3. **Pacing**: each morning's platform numbers go in; planned-to-date, pacing status,
   CPA and daily targets come out, and Jev flags the lines that need the manager.
4. **Weekly report**: a two-page client status report drafted from the numbers, edited,
   then printed or saved as PDF.

**Download media plan (.xlsx)** exports the client workbook: Media Plan, Flowchart and
an internal Pacing Tracker, with inputs in blue and everything else as live Excel
formulas. Edits are kept in the browser; **Reset to sample** restores the example.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. Everything works from the committed fixtures with no
API key.

```bash
npm run preflight   # verifies the scenario, the fixtures and that replay calls nothing
```

## Live Jev

Optional. Only needed to record new decisions or to score a hand-edited plan
against the real model rather than the local heuristic.

```bash
cp .env.example .env     # add an OpenRouter key
JEV_MODE=live npm run dev
```

Jev costs roughly US$0.00007 per call. A full pass over all 24 campaigns is about
US$0.002. The interface shows these in CAD at a fixed 1.37. Prose is the expensive part, which is why only the handful a human reads
gets narrated.

## Deploy

Two targets from one codebase.

```bash
npm run build        # server target: all endpoints dynamic, Jev stays live
npm run build:pages  # static target: prerendered, no server
```


Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/pages.yml`. The build needs no secrets: every decision is
replayed from `fixtures/`, so it is reproducible and cannot leak a key.

One consequence worth knowing: GitHub Pages has no server, so editing a plan on
the deployed site is scored by the **local heuristic** rather than by Jev, and the
interface says so. The canonical decisions are all real, recorded Jev output.

## What is real and what is not

Real: Jev, and every recorded decision and probability in `fixtures/`. Walmart
Connect and Loblaw Advance are real retail media networks; the Sobeys and Metro
network names are descriptive placeholders.

The recorded decisions predate the Canada relabel. The numbers Jev saw are unchanged,
but the brand, retailer and channel names in the recorded requests are the earlier US
ones. Re-record with `JEV_MODE=live` to refresh them (about US$0.002).

Not real: the advertisers are used illustratively, every performance figure is
invented, the platform push is mocked, and the inventory capacities are shaped
rather than published. The interface states this on every screen.
