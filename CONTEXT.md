# CONTEXT

Glossary for Plumbline, an agent-first campaign operating system for media agencies. Market: United States and Canada. All monetary values USD.
Terms here are both type names in the code and demo vocabulary. If a word appears
on screen it should appear here first.

## Core

**Policy**
What replaces the media plan. A machine-checkable statement of what the campaign
is trying to do and what the agency is permitted to do about it: objectives,
tolerances, the permitted lever set, and a threshold per lever. A Policy is
authored once (from the client brief) and then continuously evaluated. It is not
a document, and nothing re-keys it into another system.

Contrast with **Media plan**: the artifact a Policy replaces. A deck plus a
flowchart spreadsheet, produced upstream by a planner, then manually re-entered
into the ad server by a different person. IAB lists that re-entry and the audit
of that re-entry as two separate billable ad ops tasks. Both tasks exist only
because the plan is a document.

**Tick**
One observation of a Campaign at a point in time. Carries spend, pacing, CPA,
CTR and per-LineItem performance. Ticks are what the agent reacts to. In the
demo they advance on operator command; in production they would arrive on a
schedule.

**Campaign**
The thing under management. Has a Policy, a budget, a flight, and a set of
LineItems.

**LineItem**
One addressable unit of delivery: a platform, an audience and a placement, with
its own spend share and performance. Levers act on LineItems, not on Campaigns.

## Decisions

**Lever**
One of a closed set of actions the agent may propose. Closed is the point: Jev
selects over declared alternatives, so the lever set is the product's boundary of
authority. Adding a lever is a product decision, not a prompt change.

**Gate**
The Noul question asked of every Tick: does this Campaign need operator
intervention right now? Returns a calibrated probability. The probability is the
certainty; Noul has no separate confidence field, so nothing in the UI may show
one.

**Severity**
The Score question: how far is the Campaign from its objective, on an ordered
rubric. Returns a weighted position plus a confidence.

**Proposal**
What the agent produces when the Gate opens: a Lever, a target LineItem, a
Severity, and the full probability distribution behind the Choice. A Proposal is
a recommendation with its uncertainty attached, never a bare instruction.

**Threshold**
The per-Lever confidence cut above which a Proposal auto-executes instead of
queueing for a human. The threshold is the adoption dial: it starts at 1.0, which
means everything is reviewed, and ratchets down per Lever as measured Agreement
Rate justifies it.

**Agreement Rate**
Of the Proposals for a given Lever that a human has ruled on, the share the human
approved. This is the evidence that moves a Threshold. It is measured, not
asserted, which is what makes the adoption argument credible to a compliance
function.

**Queue**
The set of Proposals awaiting a human ruling. The operator's actual job in the
new model. Not a dashboard: a worklist that empties.

**Ledger**
The append-only record of every Proposal, its probabilities, the ruling, and who
or what made it. The Ledger is what makes Report possible without anyone
building a deck, and it is the audit trail a regulated client asks for.

## Roles

**Operator**
The human in the loop. Corresponds to today's programmatic or biddable
executive. Rules on the Queue and sets Thresholds. Does not build plans or
reports.

**Escalation**
The seventh lever, and the honest one. Anything touching total budget belongs to
the client, not the agency, so the agent proposes escalation rather than acting.
Demonstrates that the system knows the limit of its own authority.
