import type { Comparison, HouseholdData, ParseResult } from '../types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return undefined
}

function parseComparison(value: unknown): Comparison {
  if (!isRecord(value)) {
    throw new Error('comparison must be an object.')
  }

  const months = Array.isArray(value.months)
    ? value.months.map((month) => asString(month)).filter((month): month is string => Boolean(month))
    : []

  const dailyUnits =
    value.daily_units === null || value.daily_units === undefined
      ? null
      : (asNumber(value.daily_units) ?? null)

  return {
    months,
    source: asString(value.source) ?? 'readings',
    daily_units: dailyUnits,
    opening_balance_bdt: asString(value.opening_balance_bdt) ?? '0.00',
    low_threshold_bdt: asString(value.low_threshold_bdt) ?? '0.00',
    low_amount_bdt: asString(value.low_amount_bdt) ?? '0.00',
    monthly_amount_bdt: asString(value.monthly_amount_bdt) ?? '0.00',
  }
}

export function parseCase(value: unknown, fallbackId = 'CASE'): HouseholdData {
  if (!isRecord(value)) {
    throw new Error('Each case must be a JSON object.')
  }

  const opening = asString(value.opening_balance_bdt)
  if (opening === undefined) {
    throw new Error('Missing opening_balance_bdt (string).')
  }

  if (!Array.isArray(value.days)) {
    throw new Error('Missing days array.')
  }

  const days = value.days.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`days[${index}] must be an object with date and units.`)
    }
    const date = asString(item.date)
    const units = asNumber(item.units)
    if (!date || units === undefined) {
      throw new Error(`days[${index}] needs date (YYYY-MM-DD) and units (number).`)
    }
    return { date, units }
  })

  if (!Array.isArray(value.recharges)) {
    throw new Error('Missing recharges array.')
  }

  const recharges = value.recharges.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`recharges[${index}] must be an object with date and amount_bdt.`)
    }
    const date = asString(item.date)
    const amount = item.amount_bdt
    if (!date || (typeof amount !== 'number' && typeof amount !== 'string')) {
      throw new Error(`recharges[${index}] needs date and amount_bdt.`)
    }
    return { date, amount_bdt: amount }
  })

  const today = asString(value.today)
  const usual = asNumber(value.usual_daily_units)
  const target = asString(value.target_date)

  if (!today || usual === undefined || !target) {
    throw new Error('Need today, usual_daily_units, and target_date at the top level.')
  }

  return {
    case_id: asString(value.case_id) ?? fallbackId,
    opening_balance_bdt: opening,
    days,
    recharges,
    today,
    usual_daily_units: usual,
    target_date: target,
    comparison: parseComparison(value.comparison),
  }
}

export function parseHouseholdJson(raw: string): ParseResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { error: 'Paste household JSON before loading.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { error: 'That JSON could not be parsed. Check commas, quotes, and brackets.' }
  }

  return parseHouseholdValue(parsed)
}

export function parseHouseholdValue(parsed: unknown): ParseResult {
  try {
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return { error: 'The cases array is empty.' }
      return {
        cases: parsed.map((item, index) => parseCase(item, `CASE-${index + 1}`)),
      }
    }

    if (!isRecord(parsed)) {
      return { error: 'Root value must be a JSON object or an array of cases.' }
    }

    if (Array.isArray(parsed.cases)) {
      if (parsed.cases.length === 0) return { error: 'The cases array is empty.' }
      return {
        cases: parsed.cases.map((item, index) => parseCase(item, `CASE-${index + 1}`)),
      }
    }

    return { cases: [parseCase(parsed)] }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not read this JSON.' }
  }
}
