const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) {
  console.error('OPENROUTER_API_KEY not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const MODEL = process.env.JEV_MODEL ?? 'typesafe/jev-1.13';

const body = {
  model: MODEL,
  state: {
    campaign: 'Nuvola Yogurt — Italy Q4 Launch',
    objective: 'CPA <= 14.00 EUR',
    day: 9,
    flight_days: 30,
    budget_eur: 120000,
    spend_to_date_eur: 46800,
    pacing_index: 1.3,
    cpa_eur: 19.4,
    cpa_target_eur: 14.0,
    ctr: 0.0031,
    benchmark_ctr: 0.0042,
    top_line_item: { name: 'DV360 / IAB Shoppers > Grocery', share_of_spend: 0.61, cpa_eur: 24.1 }
  },
  questions: {
    intervene: {
      type: 'noul',
      instructions: 'Does this campaign require operator intervention right now?'
    },
    lever: {
      type: 'choice',
      instructions: 'Which single lever best corrects this campaign against its objective?',
      criteria: {
        shift_budget: 'Move budget between line items that are already live',
        adjust_bid: 'Raise or lower bids on existing line items',
        pause_placement: 'Stop delivery on an underperforming placement or line item',
        swap_creative: 'Replace the creative currently serving',
        expand_audience: 'Add or broaden an audience segment to increase reachable supply',
        no_action: 'The campaign is within tolerance and should be left alone'
      }
    },
    severity: {
      type: 'score',
      instructions: 'How severe is the gap between current performance and the objective?',
criteria: [
        'On plan, no deviation worth noting',
        'Minor drift, self correcting',
        'Material drift, needs attention this week',
        'Serious, objective at risk without action today',
        'Critical, budget is actively being wasted'
      ]
    }
  }
};

const res = await fetch('https://openrouter.ai/api/alpha/decisions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

const text = await res.text();
console.log('HTTP', res.status, res.statusText);
console.log(text);

if (res.ok) {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync('fixtures', { recursive: true });
  writeFileSync('fixtures/probe-response.json', text);
  console.log('\nRaw response saved to fixtures/probe-response.json');
}
