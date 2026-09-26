# CONTEXT

Glossary for Plumbline, an agent-first campaign operating system for media agencies. Market: Canada, including Quebec. All clients are Canada-based and all monetary values are Canadian dollars (CA$). Jev bills in US dollars; decision costs are converted at a fixed 1.37.
Terms here are both type names in the code and demo vocabulary. If a word appears
on screen it should appear here first.

## Core

**Policy**
What replaces the media plan. A machine-checkable statement of what the campaign
is trying to do and what the agency is permitted to do about it: objectives,
tolerances, the permitted lever set, and a threshold per lever. A Policy is
authored once (from the client brief) and then continuously evaluated. It is not
a document, and nothing re-keys it into another system.

The Policy and the **Media plan** are one record. People author it where they
already work, in a line-item grid with a flowchart, and the client signs off the
lines and the lever authority together. What goes away is the document as the
source of truth: the old flow built a deck and a spreadsheet, then someone
re-entered them into each platform and someone else audited the re-entry. Here the
Excel workbook and the PDF are exports of the record, and nothing is re-keyed.

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

## Channels

The four places a plan can spend. The first three are finite; only programmatic is not.

**Sponsored display** (onsite)
Ads on retailer websites: search, category and product pages. Highest intent,
lowest CPA, and it runs out.

**In-app**
Ad slots inside retailer apps, such as PC Optimum or the Walmart app: flyer, search
and basket placements. The agency does not own an app; it buys these slots through
each retailer's media network.

**Off-app**
Publisher sites the agency buys direct, such as Taboola, The Globe and Mail, The New
York Times and La Presse. Finite per deal, mid-range CPA, and each publisher has its
own creative specs and language (La Presse is French only).

**Programmatic**
The Trade Desk and DV360, extending retailer audiences across the open web and CTV.
Effectively unbounded, always the most expensive per outcome. The release valve when
the finite channels underfill.

## Campaign flow

**Media plan**
The brief plus one line item per buy: channel, partner, tactic, targeting, KPI, buy
type (CPM, CPC, flat), net rate and net budget. Estimated impressions are budget ÷ CPM
× 1,000; estimated clicks are budget ÷ CPC.

**Funnel role**
How a line is judged. Performance lines are held to the CPA target; awareness lines
(CTV, online video, audio, podcast) are measured on reach, because last-touch CPA
understates them; non-working lines (ad serving, verification) and the held reserve
are neither.

**Flowchart**
The weekly spread of the budget: one weight per week, applied to every line that is
not held. Held lines, like the test and learn reserve, stay unflighted until the
client releases them.

**Planned to date**
Each flowchart week prorated by how much of it has elapsed. **Pacing** is actual spend
÷ planned to date, and a line is over- or under-pacing outside the 90 to 110 percent
band.

**Weekly report**
The client-facing status report: headline numbers, summary, performance by channel,
cost per conversion against target, what changed, decisions needed, and what is
coming up. The draft is written from the numbers; nothing in it is generated.

## Search

**Search term**
What a shopper actually typed into retailer search, onsite or in-app, that caused an
ad to show. Different from the keyword the agency bid on.

**Keyword** and **match type**
What the agency bids on. Exact match shows only for that term; phrase and broad match
also show for related searches, which is where search terms come from.

**Negative keyword**
A term the ads must not show for. The main tool for stopping wasted spend.

**Search-term triage**
Reading the search-term report and deciding, term by term, whether to promote,
negate, re-bid or leave each one. Jev asks the same three typed questions of every
term, and only the exceptions reach the campaign manager: competitor and
private-label brands, brand-safety terms, and material spend where the answer is
genuinely unclear.

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
