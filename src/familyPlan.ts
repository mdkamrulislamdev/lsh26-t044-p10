import type { ClosedShopAdvice, PredictionBreakdown, SlabPosition } from './billingEngine'

export type FamilyPlanInput = {
  generatedOn: string
  monthCount: number
  lightMonth: string
  lightUnits: number
  heavyMonth: string
  heavyUnits: number
  lastWeekRecharge: string
  todayBalance: number
  usualDailyUnits: number | undefined
  runOutDate: string | null | undefined
  targetDate: string
  amountNeededToday: number | undefined
  breakdown: PredictionBreakdown | undefined
  habitWinner: string | null
  habitDifference: number | null
  lowBalanceCost: number | null
  monthlyCost: number | null
  slab: SlabPosition
  daysUntilNextSlab: number | null
  shop: ClosedShopAdvice
  weekendCoverAmount: number | null
}

const PAGE_W = 595
const PAGE_H = 842

function money(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '-'
  return `${value.toFixed(2)} BDT`
}

function pdfSafe(value: string): string {
  return value
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/৳/g, 'BDT ')
    .replace(/·/g, '|')
    .replace(/[^\x20-\x7E]/g, '?')
}

function pdfEscape(value: string): string {
  return pdfSafe(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function rgb(r: number, g: number, b: number): string {
  return `${(r / 255).toFixed(4)} ${(g / 255).toFixed(4)} ${(b / 255).toFixed(4)}`
}

/** Plain-text twin of the PDF, used by tests to check the same facts. */
export function buildFamilyPlanText(input: FamilyPlanInput): string {
  const lines = [
    'MeterWise family recharge plan',
    `Generated ${input.generatedOn}`,
    '',
    'Household',
    `  Months: ${input.monthCount}`,
    `  Light month: ${input.lightMonth} · ${input.lightUnits} units`,
    `  Heavy month: ${input.heavyMonth} · ${input.heavyUnits} units`,
    `  Last-week recharge: ${input.lastWeekRecharge}`,
    '',
    'Balance and questions',
    `  Today's rebuilt balance: ${money(input.todayBalance)}`,
    `  Usual daily use: ${input.usualDailyUnits ?? '-'} units`,
    `  Run-out date: ${input.runOutDate ?? 'Does not run out within a year'}`,
    `  Amount to last until ${input.targetDate || '-'}: ${money(input.amountNeededToday)}`,
  ]

  if (input.breakdown) {
    lines.push(
      `    Energy: ${money(input.breakdown.energy)}`,
      `    Higher slab: ${money(input.breakdown.slabPenalty)}`,
      `    Fixed charges: ${money(input.breakdown.fixedCharges)}`,
      `    VAT (5% of energy): ${money(input.breakdown.vat)}`,
    )
  }

  lines.push('', 'Habits (billed cost, not deposits)')
  if (input.habitWinner) {
    lines.push(
      `  Winner: ${input.habitWinner}`,
      `  Difference: ${money(input.habitDifference)}`,
      `  Low-balance cost: ${money(input.lowBalanceCost)}`,
      `  Monthly cost: ${money(input.monthlyCost)}`,
    )
  } else {
    lines.push('  No comparison months on this household.')
  }

  lines.push(
    '',
    'Stay-on plan (bonus)',
    `  This month so far: ${input.slab.monthRunningUnits} units`,
    `  Current slab: ${input.slab.currentSlabLabel}`,
  )

  if (input.slab.unitsLeftInSlab === null) {
    lines.push('  Already on the highest slab this month.')
  } else {
    lines.push(
      `  Units left before ${input.slab.nextSlabLabel}: ${input.slab.unitsLeftInSlab}`,
      `  Days at usual use until that slab: ${input.daysUntilNextSlab ?? '-'}`,
    )
  }

  if (input.shop.shopsLikelyClosed) {
    lines.push(
      `  Run-out is ${input.shop.weekday} (${input.shop.runOutDate}).`,
      '  Many recharge shops are closed Friday-Saturday.',
      `  Recharge by ${input.shop.rechargeByDate} to last until ${input.shop.coverUntilDate}.`,
      `  Amount to cover the closed days: ${money(input.weekendCoverAmount)}`,
    )
  } else if (input.shop.weekday) {
    lines.push(
      `  Run-out is ${input.shop.weekday} (${input.shop.runOutDate}) - not on the weekly holiday.`,
    )
  } else {
    lines.push('  No run-out date within a year at usual daily use.')
  }

  lines.push('', 'Tariff is the published P10 table. This file is for the family, not a utility bill.')
  return lines.join('\n')
}

function assemblePdf(stream: string): Uint8Array {
  const objects = [
    '',
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 6 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]

  let body = '%PDF-1.4\n'
  const offsets = [0]
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = body.length
    body += `${i} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xrefPos = body.length
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let i = 1; i < objects.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  body += xref
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`
  return new TextEncoder().encode(body)
}

/** One-page A4 plan in MeterWise cream and green. Built in-browser, no upload. */
export function buildFamilyPlanPdf(input: FamilyPlanInput): Uint8Array {
  const ops: string[] = []

  const yFromTop = (top: number) => PAGE_H - top

  const box = (x: number, top: number, w: number, h: number, r: number, g: number, b: number) => {
    const y = yFromTop(top) - h
    ops.push(`${rgb(r, g, b)} rg ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`)
  }

  const bar = (x: number, top: number, w: number, h: number, r: number, g: number, b: number) => {
    box(x, top, w, h, r, g, b)
  }

  const txt = (
    x: number,
    top: number,
    size: number,
    value: string,
    bold: boolean,
    r = 23,
    g = 33,
    b = 26,
  ) => {
    const y = yFromTop(top) - size
    const font = bold ? '/F2' : '/F1'
    ops.push(
      `BT ${font} ${size} Tf ${rgb(r, g, b)} rg ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfEscape(value)}) Tj ET`,
    )
  }

  const runOut =
    input.runOutDate ?? 'Does not run out within a year'
  const habitLine = input.habitWinner
    ? input.habitWinner === 'Tie'
      ? `Same billed cost: ${money(input.lowBalanceCost)}`
      : `${input.habitWinner} costs less by ${money(input.habitDifference)}`
    : 'No comparison months on this household.'

  box(0, 0, PAGE_W, PAGE_H, 243, 239, 230)
  box(0, 0, PAGE_W, 86, 11, 110, 79)
  box(0, 86, PAGE_W, 6, 15, 158, 110)

  txt(36, 28, 22, 'MeterWise', true, 255, 255, 255)
  txt(36, 54, 11, 'Family recharge plan', false, 231, 243, 238)
  txt(36, 70, 9, 'Prepaid meter advisor  |  Keep the lights on', false, 199, 227, 215)
  txt(400, 32, 9, `Generated ${input.generatedOn}`, false, 231, 243, 238)
  txt(400, 48, 8, 'Local file  |  Not a utility bill', false, 199, 227, 215)

  txt(36, 112, 8, 'HOUSEHOLD', true, 11, 110, 79)
  const cardW = 250
  const cardH = 52
  const facts: Array<[string, string]> = [
    ['Months', String(input.monthCount)],
    ['Light month', `${input.lightMonth} | ${input.lightUnits} units`],
    ['Heavy month', `${input.heavyMonth} | ${input.heavyUnits} units`],
    ['Last-week recharge', input.lastWeekRecharge],
  ]
  facts.forEach((fact, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const x = 36 + col * (cardW + 16)
    const top = 124 + row * (cardH + 10)
    box(x, top, cardW, cardH, 255, 252, 247)
    bar(x, top, 4, cardH, 11, 110, 79)
    txt(x + 16, top + 14, 8, fact[0], false, 92, 99, 88)
    txt(x + 16, top + 30, 11, fact[1].slice(0, 34), true, 23, 33, 26)
  })

  txt(36, 250, 8, 'BALANCE AND QUESTIONS', true, 11, 110, 79)
  box(36, 262, 250, 118, 255, 244, 237)
  txt(52, 278, 8, 'When does the balance run out?', false, 194, 65, 12)
  txt(52, 298, 10, `Today ${money(input.todayBalance)}`, false, 92, 99, 88)
  txt(52, 316, 9, `${input.usualDailyUnits ?? '-'} units / day`, false, 92, 99, 88)
  txt(52, 340, 16, String(runOut), true, 23, 33, 26)

  box(302, 262, 257, 118, 231, 243, 238)
  txt(318, 278, 8, 'Recharge today to last until', false, 9, 77, 56)
  txt(318, 296, 11, input.targetDate || 'No date picked', true, 23, 33, 26)
  txt(318, 318, 16, money(input.amountNeededToday), true, 11, 110, 79)
  if (input.breakdown) {
    txt(
      318,
      344,
      8,
      `Energy ${money(input.breakdown.energy)}   VAT ${money(input.breakdown.vat)}`,
      false,
      92,
      99,
      88,
    )
    txt(
      318,
      358,
      8,
      `Higher slab ${money(input.breakdown.slabPenalty)}   Fixed ${money(input.breakdown.fixedCharges)}`,
      false,
      92,
      99,
      88,
    )
  }

  txt(36, 402, 8, 'HABITS  |  BILLED COST, NOT DEPOSITS', true, 11, 110, 79)
  box(36, 414, 523, 88, 231, 243, 238)
  txt(52, 432, 8, 'Which costs less', false, 9, 77, 56)
  txt(52, 450, 14, habitLine, true, 23, 33, 26)
  txt(52, 474, 9, `Low balance: ${money(input.lowBalanceCost)}`, false, 92, 99, 88)
  txt(280, 474, 9, `Start of month: ${money(input.monthlyCost)}`, false, 92, 99, 88)

  txt(36, 524, 8, 'STAY-ON PLAN  |  BONUS', true, 11, 110, 79)
  box(36, 536, 250, 150, 255, 252, 247)
  bar(36, 536, 4, 150, 11, 110, 79)
  txt(56, 552, 8, 'This month tariff slab', false, 92, 99, 88)
  txt(56, 570, 10, `${input.slab.monthRunningUnits} units so far`, true, 23, 33, 26)
  txt(56, 588, 9, input.slab.currentSlabLabel.slice(0, 36), false, 23, 33, 26)
  if (input.slab.unitsLeftInSlab === null) {
    txt(56, 612, 9, 'Already on the highest slab.', false, 92, 99, 88)
  } else {
    txt(56, 612, 9, `${input.slab.unitsLeftInSlab} units left in this slab`, false, 23, 33, 26)
    txt(56, 628, 9, `${input.daysUntilNextSlab ?? '-'} days at usual use until next rate`, false, 92, 99, 88)
    txt(56, 648, 8, (input.slab.nextSlabLabel ?? '').slice(0, 38), false, 92, 99, 88)
  }

  const shopAlert = input.shop.shopsLikelyClosed
  box(302, 536, 257, 150, shopAlert ? 255 : 231, shopAlert ? 244 : 243, shopAlert ? 237 : 238)
  bar(302, 536, 4, 150, shopAlert ? 194 : 11, shopAlert ? 65 : 110, shopAlert ? 12 : 79)
  txt(322, 552, 8, 'Friday-Saturday shop closure', false, shopAlert ? 194 : 9, shopAlert ? 65 : 77, shopAlert ? 12 : 56)
  if (shopAlert) {
    txt(322, 572, 12, `Run-out is ${input.shop.weekday ?? ''}`, true, 23, 33, 26)
    txt(322, 596, 9, `Recharge by ${input.shop.rechargeByDate ?? '-'}`, false, 23, 33, 26)
    txt(322, 614, 9, `Cover through ${input.shop.coverUntilDate ?? '-'}`, false, 23, 33, 26)
    txt(322, 640, 12, money(input.weekendCoverAmount), true, 194, 65, 12)
    txt(322, 660, 8, 'Amount today for the closed days', false, 92, 99, 88)
  } else if (input.shop.weekday) {
    txt(322, 572, 12, `Run-out is ${input.shop.weekday}`, true, 23, 33, 26)
    txt(322, 596, 9, String(input.shop.runOutDate ?? ''), false, 92, 99, 88)
    txt(322, 620, 9, 'Not on the weekly holiday.', false, 92, 99, 88)
    txt(322, 640, 9, 'Still recharge before the balance hits zero.', false, 92, 99, 88)
  } else {
    txt(322, 572, 12, 'No run-out within a year', true, 23, 33, 26)
    txt(322, 596, 9, 'Usual daily use does not empty the meter', false, 92, 99, 88)
    txt(322, 616, 9, 'inside the forecast window.', false, 92, 99, 88)
  }

  txt(36, 708, 8, 'Official P10 tariff. VAT is 5% of energy only. Fixed charges are 82 BDT on the first recharge of a calendar month.', false, 92, 99, 88)
  txt(36, 724, 8, 'Habit cost is energy + VAT + 82, never the deposit. This PDF is generated on your device and is not uploaded.', false, 92, 99, 88)
  txt(36, 752, 8, 'Team lsh26-t044  |  MeterWise  |  MIT License', false, 11, 110, 79)
  txt(36, 770, 8, 'Not a DESCO / NESCO bill. Figures come from the loaded household and the published problem tariff.', false, 92, 99, 88)

  return assemblePdf(ops.join('\n'))
}

export function downloadFamilyPlanPdf(input: FamilyPlanInput): void {
  const bytes = buildFamilyPlanPdf(input)
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const blob = new Blob([buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'meterwise-family-plan.pdf'
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
