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

## How it's organised

Five places: **Inbox** (everything that needs a person, across all campaigns),
**Campaigns** (one sheet-like row per campaign), **Clients**, **History** and **Settings**.

**New client** (Clients) captures the name, category, retail partners and contact, then
opens **New campaign**: three steps (basics; channels from a template or blank; the
weekly spend pattern) that create a draft with its flowchart, ready to finish on the
Plan tab. Created clients and campaigns are kept in the browser, like other edits.

Every campaign opens the same workspace, with tabs in the order the work happens:

1. **Overview**: where the campaign stands and the model's campaign-level suggestion.
2. **Plan**: the brief and every line item. While you type, the model checks whether the
   retail, in-app and publisher lines can be delivered against the supply that exists,
   and the French-creative gate blocks anything that cannot run in Quebec.
3. **Flowchart**: weekly weights and retail moments spread each line across the flight.
4. **Pacing**: actuals against the flowchart, fill against booked spend, and a suggestion
   per line.
5. **Search terms** (retail search campaigns): every term triaged, exceptions queued.
6. **Decisions**: every approval, overrule and routine change, with its reason.
7. **Report**: the two-page client status report, drafted from the numbers and the
   decision record, then printed or saved as PDF.

Every suggestion reads the same way: a band (Clear call, Judgment call, Unsure) with
the exact probabilities on hover, the one or two facts behind it, and Approve or
Overrule. **Shadow mode** (on for a new team) records routine changes as what the rules
would do and applies nothing until the team turns it off.

**Download media plan (.xlsx)** exports the client workbook: Media Plan, Flowchart and
an internal Pacing Tracker, with inputs in blue and everything else as live Excel
formulas. Edits are kept in the browser; each campaign can be reset from its Plan tab.

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
