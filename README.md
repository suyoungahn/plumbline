# Plumbline

An agent-first campaign operating system for a retail media agency. PM case study
prototype.

A campaign manager runs 24 campaigns across 6 advertisers in the US and Canada.
Three of them need a human today. The other 21 were evaluated and cleared without
one, for a fraction of a cent. That ratio is the product.

Decisions come from **Jev**, a decision model that returns typed answers over a
closed set with calibrated probabilities and cannot generate text. A generative
model writes the prose and is never allowed to choose. Every decision on screen is
badged with its provenance.

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

Jev costs roughly $0.00007 per call. A full pass over all 24 campaigns is about
$0.002. Prose is the expensive part, which is why only the handful a human reads
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

Real: Jev, and every recorded decision and probability in `fixtures/`. The retail
media networks are real and publicly documented.

Not real: the advertisers are used illustratively, every performance figure is
invented, the platform push is mocked, and the inventory capacities are shaped
rather than published. The interface states this on every screen.
