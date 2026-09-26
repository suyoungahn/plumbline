import { CHANNELS, type MediaPlan, type Pacing } from './types';
import { estimates, flowTotals, isHeld, paceLine, planTotals, toDate, weekStart, weekly, weekElapsed } from './calc';

// Builds the client workbook: Media Plan, Flowchart and an internal Pacing Tracker.
// Inputs are written as values in blue; everything else is a live Excel formula, with
// the value this app computed cached alongside so previews show numbers before Excel
// recalculates.

const NAVY = 'FF0B2545';
const INPUT = { color: { argb: 'FF1F4FD8' } };
const MONEY = '"CA$"#,##0';
const MONEY2 = '"CA$"#,##0.00';
const PCT = '0%';
const PCT1 = '0.0%';
const INT = '#,##0';
const DATE = 'm/d/yy';

const col = (n: number) => {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

type Cell = import('exceljs').Cell;
type Sheet = import('exceljs').Worksheet;

function header(ws: Sheet, row: number, labels: string[]) {
  labels.forEach((label, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = label;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    c.alignment = { vertical: 'middle', wrapText: true };
  });
  ws.getRow(row).height = 30;
}

function title(ws: Sheet, text: string, sub: string) {
  ws.getCell('A1').value = text;
  ws.getCell('A1').font = { bold: true, size: 15, color: { argb: NAVY } };
  ws.getCell('A2').value = sub;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF595959' } };
}

const f = (formula: string, result?: number | string | Date) => ({ formula, result }) as never;

function input(c: Cell, value: unknown, numFmt?: string) {
  c.value = value as never;
  c.font = INPUT;
  if (numFmt) c.numFmt = numFmt;
}

export async function buildWorkbook(plan: MediaPlan, pacing: Pacing): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Plumbline';
  wb.calcProperties.fullCalcOnLoad = true;

  const n = plan.lines.length;
  const first = 9;
  const last = first + n - 1;
  const total = last + 1;
  const tot = planTotals(plan);
  const short = plan.campaign;

  // ---------------------------------------------------------------- Media Plan
  const mp = wb.addWorksheet('Media Plan', { views: [{ state: 'frozen', ySplit: 8 }] });
  title(mp, `${short} — Media Plan`, `Prepared for ${plan.preparedFor} | ${plan.status} | All figures net CAD, excluding agency fee`);
  const kv = (r: number, c: number, k: string, v: unknown, fmt?: string) => {
    mp.getCell(r, c).value = k;
    mp.getCell(r, c).font = { bold: true };
    input(mp.getCell(r, c + 1), v, fmt);
  };
  kv(3, 1, 'Client', plan.client);
  kv(4, 1, 'Campaign', plan.campaign);
  kv(5, 1, 'Objective', plan.objective);
  kv(6, 1, 'Primary KPI', `Cost per new ${plan.conversionName} (target CA$${plan.targetCpa.toFixed(2)})`);
  kv(3, 6, 'Flight start', toDate(plan.flightStart), DATE);
  kv(4, 6, 'Flight end', toDate(plan.flightEnd), DATE);
  kv(5, 6, 'Total budget', plan.totalBudget, MONEY);
  kv(6, 6, 'Target CPA', plan.targetCpa, MONEY2);

  header(mp, 8, ['#', 'Channel', 'Partner / Platform', 'Tactic & Placement', 'Targeting', 'KPI', 'Buy Type', 'Rate (net)', 'Net Budget', '% of Total', 'Est. Impressions', 'Est. Clicks', 'Flight Start', 'Flight End']);
  plan.lines.forEach((l, i) => {
    const r = first + i;
    const e = estimates(l);
    mp.getCell(r, 1).value = i + 1;
    input(mp.getCell(r, 2), CHANNELS[l.channel].label);
    input(mp.getCell(r, 3), l.partner);
    input(mp.getCell(r, 4), l.tactic);
    input(mp.getCell(r, 5), l.targeting);
    input(mp.getCell(r, 6), l.kpi);
    input(mp.getCell(r, 7), l.buyType);
    input(mp.getCell(r, 8), l.buyType === 'CPM' || l.buyType === 'CPC' ? l.rate : null, MONEY2);
    input(mp.getCell(r, 9), l.budget, MONEY);
    mp.getCell(r, 10).value = f(`IFERROR(I${r}/$I$${total},0)`, tot.budget ? l.budget / tot.budget : 0);
    mp.getCell(r, 10).numFmt = PCT1;
    mp.getCell(r, 11).value = f(`IF(G${r}="CPM",I${r}/H${r}*1000,0)`, e.impressions);
    mp.getCell(r, 11).numFmt = INT;
    mp.getCell(r, 12).value = f(`IF(G${r}="CPC",I${r}/H${r},0)`, e.clicks);
    mp.getCell(r, 12).numFmt = INT;
    mp.getCell(r, 13).value = f('$G$3', toDate(plan.flightStart));
    mp.getCell(r, 13).numFmt = DATE;
    mp.getCell(r, 14).value = f('$G$4', toDate(plan.flightEnd));
    mp.getCell(r, 14).numFmt = DATE;
  });
  mp.getCell(total, 2).value = 'TOTAL';
  const totals: [number, string, number, string][] = [
    [9, `SUM(I${first}:I${last})`, tot.budget, MONEY],
    [10, `SUM(J${first}:J${last})`, 1, PCT],
    [11, `SUM(K${first}:K${last})`, tot.impressions, INT],
    [12, `SUM(L${first}:L${last})`, tot.clicks, INT]
  ];
  for (const [c, formula, result, fmt] of totals) {
    mp.getCell(total, c).value = f(formula, result);
    mp.getCell(total, c).numFmt = fmt;
  }
  mp.getRow(total).font = { bold: true };
  mp.getRow(total).border = { top: { style: 'thin' } } as never;
  mp.getCell(total + 1, 8).value = 'Check vs budget';
  mp.getCell(total + 1, 9).value = f(`IF(I${total}=G5,"OK","Off by "&TEXT(I${total}-G5,"$#,##0"))`, tot.offBy === 0 ? 'OK' : `Off by ${tot.offBy}`);

  let r = total + 3;
  mp.getCell(r++, 2).value = 'Notes & assumptions';
  mp.getCell(r - 1, 2).font = { bold: true };
  for (const note of plan.notes) mp.getCell(r++, 2).value = `• ${note}`;
  mp.getCell(r++, 2).value = 'Legend: blue text = editable input; black = formula.';
  r++;
  mp.getCell(r++, 2).value = 'Client approval';
  mp.getCell(r - 1, 2).font = { bold: true };
  for (const [k, v] of [['Name:', plan.approval.name], ['Title:', plan.approval.title], ['Signature:', ''], ['Date:', plan.approval.date]]) {
    mp.getCell(r, 2).value = k;
    input(mp.getCell(r++, 3), v);
  }
  [5, 26, 22, 42, 44, 26, 10, 11, 13, 10, 15, 12, 11, 11].forEach((w, i) => (mp.getColumn(i + 1).width = w));

  // ---------------------------------------------------------------- Flowchart
  const W = plan.weeks.length;
  const wc = (i: number) => col(4 + i);
  const lastW = wc(W - 1);
  const fc = wb.addWorksheet('Flowchart', { views: [{ state: 'frozen', xSplit: 3, ySplit: 8 }] });
  title(fc, `${short} — Flight Plan (Weekly Flowchart)`, 'Weekly net spend by line. Change the blue weights to re-flight.');
  fc.getCell('A4').value = 'Week starting';
  fc.getCell('A5').value = 'Weekly weight';
  fc.getCell('A6').value = 'Key retail moment';
  plan.weeks.forEach((w, i) => {
    const c = fc.getCell(4, 4 + i);
    c.value = i === 0 ? f(`'Media Plan'!G3`, toDate(plan.flightStart)) : f(`${wc(i - 1)}4+7`, toDate(weekStart(plan, i)));
    c.numFmt = DATE;
    input(fc.getCell(5, 4 + i), w.weight, PCT);
    input(fc.getCell(6, 4 + i), w.moment);
    fc.getCell(6, 4 + i).alignment = { wrapText: true, vertical: 'top' };
  });
  const wsum = plan.weeks.reduce((s, w) => s + w.weight, 0);
  fc.getCell(5, 4 + W).value = f(`SUM(D5:${lastW}5)`, wsum);
  fc.getCell(5, 4 + W).numFmt = PCT;
  fc.getCell(5, 5 + W).value = f(`IF(ROUND(${col(4 + W)}5,4)=1,"OK","Weights ≠ 100%")`, Math.round(wsum * 1e4) === 1e4 ? 'OK' : 'Weights ≠ 100%');
  fc.getRow(6).height = 42;

  header(fc, 8, ['Channel', 'Partner', 'Net Budget', ...plan.weeks.map((_, i) => `Wk ${i + 1}`), 'Total', 'Check']);
  const ft = flowTotals(plan);
  plan.lines.forEach((l, i) => {
    const row = first + i;
    const mpRow = first + i;
    fc.getCell(row, 1).value = f(`'Media Plan'!B${mpRow}`, CHANNELS[l.channel].label);
    fc.getCell(row, 2).value = f(`'Media Plan'!C${mpRow}`, l.partner);
    fc.getCell(row, 3).value = f(`'Media Plan'!I${mpRow}`, l.budget);
    fc.getCell(row, 3).numFmt = MONEY;
    const wk = weekly(plan, l);
    plan.weeks.forEach((_, k) => {
      const c = fc.getCell(row, 4 + k);
      if (isHeld(plan, l)) input(c, 0, MONEY);
      else {
        c.value = f(`$C${row}*${wc(k)}$5`, wk[k]);
        c.numFmt = MONEY;
        if (wk[k] > 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F7' } };
      }
    });
    const lineTotal = wk.reduce((s, v) => s + v, 0);
    fc.getCell(row, 4 + W).value = f(`SUM(D${row}:${lastW}${row})`, lineTotal);
    fc.getCell(row, 4 + W).numFmt = MONEY;
    fc.getCell(row, 5 + W).value = f(
      `IF(ROUND(${col(4 + W)}${row}-C${row},0)=0,"OK",IF(${col(4 + W)}${row}=0,"Held","Diff"))`,
      Math.round(lineTotal - l.budget) === 0 ? 'OK' : lineTotal === 0 ? 'Held' : 'Diff'
    );
  });
  fc.getCell(total, 1).value = 'WEEKLY TOTAL';
  fc.getCell(total, 3).value = f(`SUM(C${first}:C${last})`, tot.budget);
  fc.getCell(total, 3).numFmt = MONEY;
  plan.weeks.forEach((_, k) => {
    const c = fc.getCell(total, 4 + k);
    c.value = f(`SUM(${wc(k)}${first}:${wc(k)}${last})`, ft.byWeek[k]);
    c.numFmt = MONEY;
    const cu = fc.getCell(total + 1, 4 + k);
    cu.value = f(`SUM($D${total}:${wc(k)}${total})`, ft.cumulative[k]);
    cu.numFmt = MONEY;
    const cp = fc.getCell(total + 2, 4 + k);
    cp.value = f(`IFERROR(${wc(k)}${total + 1}/'Media Plan'!$G$5,0)`, ft.cumulativePct[k]);
    cp.numFmt = PCT;
  });
  fc.getCell(total, 4 + W).value = f(`SUM(D${total}:${lastW}${total})`, ft.cumulative[W - 1] ?? 0);
  fc.getCell(total, 4 + W).numFmt = MONEY;
  fc.getRow(total).font = { bold: true };
  fc.getCell(total + 1, 1).value = 'Cumulative spend';
  fc.getCell(total + 2, 1).value = 'Cumulative % of budget';
  fc.getCell(total + 4, 1).value = 'Shaded cells = line is live that week. Held lines are unflighted until approved, so the gap in cumulative % is intentional.';
  [26, 22, 12, ...plan.weeks.map(() => 13), 13, 9].forEach((w, i) => (fc.getColumn(i + 1).width = w));

  // ---------------------------------------------------------------- Pacing Tracker
  const pt = wb.addWorksheet('Pacing Tracker', { views: [{ state: 'frozen', xSplit: 2, ySplit: 12 }] });
  title(pt, `${short} — Daily Pacing Tracker (INTERNAL)`, 'Update blue cells each morning from platform reports. Not for client distribution.');
  const pc = (i: number) => col(5 + i);
  const lastP = pc(W - 1);
  const elapsed = weekElapsed(plan, pacing);
  const setKV = (row: number, k: string, v: unknown, fmt?: string, isInput = false) => {
    pt.getCell(row, 1).value = k;
    pt.getCell(row, 1).font = { bold: true };
    if (isInput) input(pt.getCell(row, 2), v, fmt);
    else {
      pt.getCell(row, 2).value = v as never;
      if (fmt) pt.getCell(row, 2).numFmt = fmt;
    }
  };
  setKV(3, 'Data through (date)', toDate(pacing.dataThrough), DATE, true);
  setKV(4, 'Flight start', f(`'Media Plan'!G3`, toDate(plan.flightStart)), DATE);
  setKV(5, 'Flight end', f(`'Media Plan'!G4`, toDate(plan.flightEnd)), DATE);
  setKV(6, 'Days elapsed', f('B3-B4+1'));
  setKV(7, 'Days remaining', f('B5-B3'));
  setKV(8, 'Over-pace threshold', pacing.overPace, PCT, true);
  setKV(9, 'Under-pace threshold', pacing.underPace, PCT, true);
  setKV(10, 'Target CPA', f(`'Media Plan'!G6`, plan.targetCpa), MONEY2);
  pt.getCell('D3').value = 'Week start';
  pt.getCell('D4').value = '% of week elapsed';
  pt.getCell('D5').value = "Helper: prorates the flowchart into 'Planned to Date'.";
  plan.weeks.forEach((_, i) => {
    const c = pt.getCell(3, 5 + i);
    c.value = f(`Flowchart!${wc(i)}4`, toDate(weekStart(plan, i)));
    c.numFmt = DATE;
    const e = pt.getCell(4, 5 + i);
    e.value = f(`MAX(0,MIN(1,($B$3-${pc(i)}3+1)/7))`, elapsed[i]);
    e.numFmt = PCT;
  });

  const pr = 13;
  const prLast = pr + n - 1;
  const prTot = prLast + 1;
  header(pt, 12, ['Channel', 'Partner', 'Net Budget', 'Planned to Date', 'Actual Spend to Date', 'Pacing %', 'Status', '% Budget Spent', 'Remaining Budget', 'Yesterday Spend', 'Daily Target', 'Impressions', `${cap(plan.conversionName)}s`, 'CPA', 'CPA vs Target', 'Action / Notes']);
  plan.lines.forEach((l, i) => {
    const row = pr + i;
    const fr = first + i;
    const p = paceLine(plan, pacing, l);
    const a = p.actual;
    pt.getCell(row, 1).value = f(`'Media Plan'!B${fr}`, CHANNELS[l.channel].label);
    pt.getCell(row, 2).value = f(`'Media Plan'!C${fr}`, l.partner);
    pt.getCell(row, 3).value = f(`'Media Plan'!I${fr}`, l.budget);
    pt.getCell(row, 4).value = f(`SUMPRODUCT(Flowchart!D${fr}:${lastW}${fr},$E$4:$${lastP}$4)`, p.planned);
    input(pt.getCell(row, 5), a.spend, MONEY);
    pt.getCell(row, 6).value = f(`IF(D${row}=0,"n/a",E${row}/D${row})`, p.pacing ?? 'n/a');
    pt.getCell(row, 7).value = f(`IF(D${row}=0,"Held",IF(F${row}>$B$8,"Overpacing",IF(F${row}<$B$9,"Underpacing","On pace")))`, p.status);
    pt.getCell(row, 8).value = f(`IFERROR(E${row}/C${row},0)`, p.spentPct);
    pt.getCell(row, 9).value = f(`C${row}-E${row}`, p.remaining);
    input(pt.getCell(row, 10), a.yesterday, MONEY);
    pt.getCell(row, 11).value = f(`IFERROR(INDEX(Flowchart!D${fr}:${lastW}${fr},MATCH($B$3,$E$3:$${lastP}$3,1))/7,0)`, p.dailyTarget);
    input(pt.getCell(row, 12), a.impressions, INT);
    input(pt.getCell(row, 13), a.conversions, INT);
    pt.getCell(row, 14).value = f(`IF(M${row}=0,"-",E${row}/M${row})`, p.cpa ?? '-');
    pt.getCell(row, 15).value = f(`IF(M${row}=0,"-",N${row}/$B$10-1)`, p.cpaVsTarget ?? '-');
    input(pt.getCell(row, 16), a.note);
    for (const c of [5, 10, 12, 13]) pt.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF6D5' } };
  });
  pt.getCell(prTot, 1).value = 'TOTAL';
  const pSum = (c: string) => f(`SUM(${c}${pr}:${c}${prLast})`);
  for (const c of ['C', 'D', 'E', 'I', 'J', 'K', 'L', 'M']) pt.getCell(`${c}${prTot}`).value = pSum(c);
  pt.getCell(`F${prTot}`).value = f(`IF(D${prTot}=0,"n/a",E${prTot}/D${prTot})`);
  pt.getCell(`H${prTot}`).value = f(`IFERROR(E${prTot}/C${prTot},0)`);
  pt.getCell(`N${prTot}`).value = f(`IF(M${prTot}=0,"-",E${prTot}/M${prTot})`);
  pt.getCell(`O${prTot}`).value = f(`IF(M${prTot}=0,"-",N${prTot}/$B$10-1)`);
  pt.getRow(prTot).font = { bold: true };
  for (let row = pr; row <= prTot; row++) {
    for (const [c, fmt] of [['C', MONEY], ['D', MONEY], ['E', MONEY], ['F', PCT], ['H', PCT], ['I', MONEY], ['J', MONEY], ['K', MONEY], ['L', INT], ['M', INT], ['N', MONEY2], ['O', PCT]] as const)
      pt.getCell(`${c}${row}`).numFmt = fmt;
  }
  pt.getCell(prTot + 2, 1).value = 'Legend: blue text / yellow fill = update daily from platform UIs. Everything else calculates.';
  pt.getCell(prTot + 3, 1).value = "Planned to Date prorates each week of the Flowchart by days elapsed. Pacing % = Actual ÷ Planned. Daily Target = current week's flighted spend ÷ 7.";
  [26, 22, 12, 14, 14, 10, 12, 10, 14, 12, 12, 13, 10, 10, 10, 60].forEach((w, i) => (pt.getColumn(i + 1).width = w));

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function downloadWorkbook(plan: MediaPlan, pacing: Pacing) {
  const blob = await buildWorkbook(plan, pacing);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${plan.campaign.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}_Media_Plan.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
