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

function money(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(2)} BDT`
}

/** Plain-text family plan for download. No HTML. */
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
    `  Usual daily use: ${input.usualDailyUnits ?? '—'} units`,
    `  Run-out date: ${input.runOutDate ?? 'Does not run out within a year'}`,
    `  Amount to last until ${input.targetDate || '—'}: ${money(input.amountNeededToday)}`,
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
      `  Days at usual use until that slab: ${input.daysUntilNextSlab ?? '—'}`,
    )
  }

  if (input.shop.shopsLikelyClosed) {
    lines.push(
      `  Run-out is ${input.shop.weekday} (${input.shop.runOutDate}).`,
      '  Many recharge shops are closed Friday–Saturday.',
      `  Recharge by ${input.shop.rechargeByDate} to last until ${input.shop.coverUntilDate}.`,
      `  Amount to cover the closed days: ${money(input.weekendCoverAmount)}`,
    )
  } else if (input.shop.weekday) {
    lines.push(
      `  Run-out is ${input.shop.weekday} (${input.shop.runOutDate}) — not on the weekly holiday.`,
    )
  } else {
    lines.push('  No run-out date within a year at usual daily use.')
  }

  lines.push('', 'Tariff is the published P10 table. This file is for the family, not a utility bill.')
  return lines.join('\n')
}

export function downloadPlainText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
