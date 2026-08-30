/**
 * PHASE 6: Constants & State Setup
 * These are strictly defined by the problem statement.
 * Do not alter these rates.
 */

export const METER_RENT = 40.0
export const DEMAND_CHARGE = 42.0
export const VAT_MULTIPLIER = 0.05 // 5%

// Structuring the slabs for easy calculation.
// 'limit' is the highest unit in that tier. 'Infinity' captures the top tier.
export const TARIFF_SLABS = [
  { limit: 75, rate: 4.63 }, // Units 1 to 75
  { limit: 200, rate: 5.26 }, // Units 76 to 200
  { limit: 300, rate: 5.63 }, // Units 201 to 300
  { limit: 400, rate: 5.83 }, // Units 301 to 400
  { limit: 600, rate: 9.3 }, // Units 401 to 600 (problem rate: 9.30)
  { limit: Infinity, rate: 10.7 }, // Units 601 and above (problem rate: 10.70)
] as const

export type MeterEngineState = {
  balance: number
  currentMonth: string | null
  monthRunningUnits: number
  hasPaidFixedChargesThisMonth: boolean
}

/**
 * Helper stub for Phase 7 (The Loop)
 * This object will track the state as we iterate day by day.
 */
export function createInitialMeterState(openingBalance: string | number): MeterEngineState {
  return {
    balance: parseFloat(String(openingBalance)),
    currentMonth: null,
    monthRunningUnits: 0,
    hasPaidFixedChargesThisMonth: false,
  }
}

export type SimulationDay = {
  date: string
  units: number
}

export type SimulationRecharge = {
  date: string
  amount_bdt: string | number
}

export type SimulationPoint = {
  date: string
  balance: number
  rechargeAmount: number | null
  units: number
  rawEnergyCost: number
  vat: number
  fixedChargesTaken: number
  monthRunningUnits: number
}

export type PredictionState = MeterEngineState & {
  date: string
}

export type SimulationResult = {
  finalBalance: number
  history: SimulationPoint[]
  finalState: PredictionState
}

/** Round taka to two decimal places (paisa). */
export function roundTaka(value: number): number {
  return parseFloat(value.toFixed(2))
}
export function calendarMonthKey(isoDate: string): string {
  const [year, month] = isoDate.split('-')
  return `${year}-${Number(month) - 1}`
}

/**
 * PHASE 7: The Slab Calculator
 * Accurately splits a day's units across tariff slabs based on the month's running total.
 */
export function calculateEnergyCost(dailyUnits: number, monthRunningUnits: number): number {
  let remainingUnits = dailyUnits
  let currentCounter = monthRunningUnits
  let totalCost = 0

  for (const slab of TARIFF_SLABS) {
    if (remainingUnits <= 0) break

    if (currentCounter < slab.limit) {
      const roomInSlab = slab.limit - currentCounter
      const unitsToChargeAtThisRate = Math.min(remainingUnits, roomInSlab)

      totalCost += unitsToChargeAtThisRate * slab.rate
      remainingUnits -= unitsToChargeAtThisRate
      currentCounter += unitsToChargeAtThisRate
    }
  }

  return roundTaka(totalCost)
}

/**
 * PHASE 8: The Chronological Simulation Loop
 * Rebuilds the balance timeline day by day.
 */
export function runSimulation(
  days: SimulationDay[],
  recharges: SimulationRecharge[],
  openingBalance: string | number,
): SimulationResult {
  let balance = parseFloat(String(openingBalance))
  let currentMonth: string | null = null
  let monthRunningUnits = 0
  let hasPaidFixedChargesThisMonth = false

  const history: SimulationPoint[] = []

  days.forEach((dayObj) => {
    const monthKey = calendarMonthKey(dayObj.date)

    if (currentMonth !== monthKey) {
      currentMonth = monthKey
      monthRunningUnits = 0
      hasPaidFixedChargesThisMonth = false
    }

    const todaysRecharges = recharges.filter((recharge) => recharge.date === dayObj.date)
    let rechargeTotalToday = 0
    let fixedChargesTakenToday = 0

    todaysRecharges.forEach((recharge) => {
      const amount = parseFloat(String(recharge.amount_bdt))
      balance += amount
      rechargeTotalToday += amount

      if (!hasPaidFixedChargesThisMonth) {
        fixedChargesTakenToday = METER_RENT + DEMAND_CHARGE
        balance -= fixedChargesTakenToday
        hasPaidFixedChargesThisMonth = true
      }
    })

    const rawEnergyCost = calculateEnergyCost(dayObj.units, monthRunningUnits)
    const vat = roundTaka(rawEnergyCost * VAT_MULTIPLIER)
    const totalDailyConsumptionCost = roundTaka(rawEnergyCost + vat)

    balance -= totalDailyConsumptionCost
    monthRunningUnits += dayObj.units

    history.push({
      date: dayObj.date,
      balance: parseFloat(balance.toFixed(2)),
      rechargeAmount: rechargeTotalToday > 0 ? rechargeTotalToday : null,
      units: dayObj.units,
      rawEnergyCost,
      vat,
      fixedChargesTaken: fixedChargesTakenToday,
      monthRunningUnits,
    })
  })

  return {
    finalBalance: balance,
    history,
    finalState: {
      balance: parseFloat(balance.toFixed(2)),
      currentMonth,
      monthRunningUnits,
      hasPaidFixedChargesThisMonth,
      date: history[history.length - 1]?.date ?? '',
    },
  }
}

export type PredictionBreakdown = {
  energy: number
  vat: number
  fixedCharges: number
  slabPenalty: number
}

export type PredictionResult = {
  runOutDate: string | null
  amountNeededToday: number
  breakdown: PredictionBreakdown
}

export type ComparisonConfig = {
  months: string[]
  opening_balance_bdt: string | number
  low_threshold_bdt: string | number
  low_amount_bdt: string | number
  monthly_amount_bdt: string | number
}

export type HabitComparisonResult = {
  lowBalanceCost: number
  monthlyCost: number
  winner: 'Low Balance' | 'Monthly' | 'Tie'
  difference: number
}

function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const next = new Date(year, month - 1, day + days)
  const yyyy = String(next.getFullYear())
  const mm = String(next.getMonth() + 1).padStart(2, '0')
  const dd = String(next.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function isFirstDayOfMonth(isoDate: string): boolean {
  return isoDate.slice(8, 10) === '01'
}

/**
 * PHASE 9: Prediction Algorithm
 * Calculates when the balance will run out and how much is needed to hit a target.
 */
export function runPredictions(
  currentState: PredictionState,
  usualDailyUnits: number,
  targetDate: string,
): PredictionResult {
  let {
    balance,
    currentMonth,
    monthRunningUnits,
    hasPaidFixedChargesThisMonth,
    date,
  } = currentState

  let currentDate = date
  let runOutDate: string | null = null

  const breakdown: PredictionBreakdown = { energy: 0, vat: 0, fixedCharges: 0, slabPenalty: 0 }
  const baseSlabCost = 4.63

  const maxSimulationDays = 365
  let daysSimulated = 0

  while (daysSimulated < maxSimulationDays) {
    currentDate = addCalendarDays(currentDate, 1)
    daysSimulated += 1
    const dateStr = currentDate
    const monthKey = calendarMonthKey(dateStr)

    if (currentMonth !== monthKey) {
      currentMonth = monthKey
      monthRunningUnits = 0
      hasPaidFixedChargesThisMonth = false
    }

    const energyCost = calculateEnergyCost(usualDailyUnits, monthRunningUnits)
    const vat = roundTaka(energyCost * VAT_MULTIPLIER)
    const dailyTotal = roundTaka(energyCost + vat)

    if (dateStr <= targetDate) {
      breakdown.energy += energyCost
      breakdown.vat += vat
      breakdown.slabPenalty += energyCost - usualDailyUnits * baseSlabCost

      if (!hasPaidFixedChargesThisMonth && daysSimulated === 1) {
        const fixed = METER_RENT + DEMAND_CHARGE
        breakdown.fixedCharges += fixed
        hasPaidFixedChargesThisMonth = true
      }
    }

    balance -= dailyTotal
    monthRunningUnits += usualDailyUnits

    if (balance <= 0 && !runOutDate) {
      runOutDate = dateStr
    }

    if (runOutDate && dateStr > targetDate) {
      break
    }
  }

  const energy = roundTaka(breakdown.energy)
  const vat = roundTaka(energy * VAT_MULTIPLIER)
  const fixedCharges = roundTaka(breakdown.fixedCharges)

  return {
    runOutDate,
    amountNeededToday: roundTaka(energy + vat + fixedCharges),
    breakdown: {
      energy,
      vat,
      fixedCharges,
      slabPenalty: roundTaka(breakdown.slabPenalty),
    },
  }
}

/**
 * PHASE 10: Habit Comparison
 * Runs the consumption data through two different recharge rules.
 */
export function compareHabits(
  days: SimulationDay[],
  comparisonConfig: ComparisonConfig,
): HabitComparisonResult {
  const {
    months,
    opening_balance_bdt,
    low_threshold_bdt,
    low_amount_bdt,
    monthly_amount_bdt,
  } = comparisonConfig

  const simulationDays = days.filter((day) => {
    const dayMonth = day.date.substring(0, 7)
    return months.includes(dayMonth)
  })

  const simulate = (isMonthlyHabit: boolean) => {
    let balance = parseFloat(String(opening_balance_bdt))
    let currentMonth: string | null = null
    let monthRunningUnits = 0
    let hasPaidFixedChargesThisMonth = false
    let totalCost = 0

    simulationDays.forEach((day) => {
      const monthKey = calendarMonthKey(day.date)

      if (currentMonth !== monthKey) {
        currentMonth = monthKey
        monthRunningUnits = 0
        hasPaidFixedChargesThisMonth = false
      }

      let triggeredRecharge = false
      if (isMonthlyHabit && isFirstDayOfMonth(day.date)) {
        balance += parseFloat(String(monthly_amount_bdt))
        triggeredRecharge = true
      } else if (!isMonthlyHabit && balance < parseFloat(String(low_threshold_bdt))) {
        balance += parseFloat(String(low_amount_bdt))
        triggeredRecharge = true
      }

      if (triggeredRecharge && !hasPaidFixedChargesThisMonth) {
        const fixedCharges = METER_RENT + DEMAND_CHARGE
        balance -= fixedCharges
        totalCost += fixedCharges
        hasPaidFixedChargesThisMonth = true
      }

      const energyCost = calculateEnergyCost(day.units, monthRunningUnits)
      const vat = roundTaka(energyCost * VAT_MULTIPLIER)
      const dailyConsumptionCost = roundTaka(energyCost + vat)

      balance -= dailyConsumptionCost
      totalCost += dailyConsumptionCost
      monthRunningUnits += day.units
    })

    return totalCost
  }

  const lowBalanceCost = parseFloat(simulate(false).toFixed(2))
  const monthlyCost = parseFloat(simulate(true).toFixed(2))

  return {
    lowBalanceCost,
    monthlyCost,
    winner:
      lowBalanceCost < monthlyCost
        ? 'Low Balance'
        : monthlyCost < lowBalanceCost
          ? 'Monthly'
          : 'Tie',
    difference: parseFloat(Math.abs(lowBalanceCost - monthlyCost).toFixed(2)),
  }
}
