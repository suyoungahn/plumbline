export type Stage = {
  n: number;
  name: string;
  owner: string;
  artifact: string;

  friction: string;

  becomes: 'policy' | 'continuous' | 'ledger' | 'unchanged';
};

export const LIFECYCLE: Stage[] = [
  { n: 1, name: 'Client brief', owner: 'Account director', artifact: 'Brief document',
    friction: 'Objectives arrive as prose and are interpreted differently by each downstream team',
    becomes: 'policy' },
  { n: 2, name: 'Strategy', owner: 'Planning director', artifact: 'Comms strategy deck',
    friction: 'Produced once, then diverges from what is actually running',
    becomes: 'policy' },
  { n: 3, name: 'Media planning', owner: 'Media planner', artifact: 'Channel plan, Excel flowchart',
    friction: 'IPA lists Excel proficiency as a core requirement of the role',
    becomes: 'policy' },
  { n: 4, name: 'RFP and negotiation', owner: 'Investment team', artifact: 'Proposals, rate cards',
    friction: 'Hidden inside "planning" in most descriptions of the process',
    becomes: 'unchanged' },
  { n: 5, name: 'Investment and buying', owner: 'Media buyer', artifact: 'Signed insertion order',
    friction: 'Commits budget against a plan that cannot respond to what happens next',
    becomes: 'unchanged' },
  { n: 6, name: 'Trafficking and activation', owner: 'Ad operations', artifact: 'Ad server line items',
    friction: 'IAB lists entering order details, asset intake, and auditing the entry against the plan as three separate billable tasks. That audit exists only because the plan is a document',
    becomes: 'policy' },
  { n: 7, name: 'In-flight optimization', owner: 'Programmatic or biddable executive', artifact: 'Dashboard checks, manual tweaks',
    friction: 'A human watches dashboards and decides when something has drifted far enough to act on',
    becomes: 'continuous' },
  { n: 8, name: 'Reporting', owner: 'Operations executive', artifact: 'Weekly and monthly decks',
    friction: 'The IPA role description for media operations lists maintaining the master tracker as a named duty',
    becomes: 'ledger' },
  { n: 9, name: 'Billing reconciliation', owner: 'Operations executive with finance', artifact: 'Reconciliation spreadsheet',
    friction: 'ISBA and PwC matched only 12 percent of impressions end to end; IAB and the 4A’s tolerate a 10 percent discrepancy by convention',
    becomes: 'ledger' },
  { n: 10, name: 'Business review', owner: 'Account director', artifact: 'QBR deck',
    friction: 'No high-trust source states a standard cadence, which is itself telling',
    becomes: 'ledger' }
];

export const BECOMES_LABEL: Record<Stage['becomes'], string> = {
  policy: 'Absorbed into the Policy',
  continuous: 'Becomes the continuous loop',
  ledger: 'Falls out of the Ledger',
  unchanged: 'Still human, still negotiated'
};
