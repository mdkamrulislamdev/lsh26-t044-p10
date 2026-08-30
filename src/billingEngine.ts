/** Official P10 tariff. Do not change these rates. */

export const METER_RENT = 40.0
export const DEMAND_CHARGE = 42.0
export const FIXED_CHARGES = METER_RENT + DEMAND_CHARGE
export const VAT_RATE = 0.05

/** Upper inclusive unit bound for each energy rate (BDT per unit). */
export const TARIFF_SLABS = [
  { limit: 75, rate: 4.63 },
  { limit: 200, rate: 5.26 },
  { limit: 300, rate: 5.63 },
  { limit: 400, rate: 5.83 },
  { limit: 600, rate: 9.3 },
  { limit: Infinity, rate: 10.7 },
] as const

export const FIRST_SLAB_RATE = TARIFF_SLABS[0].rate

export type MeterEngineState = {
  balance: number
  currentMonth: string | null
  monthRunningUnits: number
  hasPaidFixedChargesThisMonth: boolean
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
  source?: string
  daily_units?: number | null
}

export type HabitTotals = {
  cost: number
  energyAndVat: number
  fixedCharges: number
}

export type HabitComparisonResult = {
  lowBalanceCost: number
  monthlyCost: number
  winner: 'Low Balance' | 'Monthly' | 'Tie'
  difference: number
  energyAndVat: number
  lowBalanceFixedCharges: number
  monthlyFixedCharges: number
}

export function roundTaka(value: number): number {
  return parseFloat(value.toFixed(2))
}

/** Detects calendar-month change without parsing ISO dates as UTC. */
export function calendarMonthKey(isoDate: string): string {
  const [year, month] = isoDate.split('-')
  return `${year}-${Number(month) - 1}`
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

function groupRechargesByDate(recharges: SimulationRecharge[]): Map<string, SimulationRecharge[]> {
  const byDate = new Map<string, SimulationRecharge[]>()
  for (const recharge of recharges) {
    const list = byDate.get(recharge.date)
    if (list) list.push(recharge)
    else byDate.set(recharge.date, [recharge])
  }
  return byDate
}

/** Prices today's units at the slab the month's running total has already reached. */
export function calculateEnergyCost(dailyUnits: number, monthRunningUnits: number): number {
  let remainingUnits = dailyUnits
  let currentCounter = monthRunningUnits
  let totalCost = 0

  for (const slab of TARIFF_SLABS) {
    if (remainingUnits <= 0) break
    if (currentCounter >= slab.limit) continue

    const roomInSlab = slab.limit - currentCounter
    const unitsAtThisRate = Math.min(remainingUnits, roomInSlab)
    totalCost += unitsAtThisRate * slab.rate
    remainingUnits -= unitsAtThisRate
    currentCounter += unitsAtThisRate
  }

  return roundTaka(totalCost)
}

/** Rebuilds meter balance day by day. ৳82 is taken on the first recharge of each calendar month. */
export function runSimulation(
  days: SimulationDay[],
  recharges: SimulationRecharge[],
  openingBalance: string | number,
): SimulationResult {
  let balance = parseFloat(String(openingBalance))
  let currentMonth: string | null = null
  let monthRunningUnits = 0
  let hasPaidFixedChargesThisMonth = false
  const rechargesByDate = groupRechargesByDate(recharges)
  const history: SimulationPoint[] = []

  for (const dayObj of days) {
    const monthKey = calendarMonthKey(dayObj.date)

    if (currentMonth !== monthKey) {
      currentMonth = monthKey
      monthRunningUnits = 0
      hasPaidFixedChargesThisMonth = false
    }

    const todaysRecharges = rechargesByDate.get(dayObj.date) ?? []
    let rechargeTotalToday = 0
    let fixedChargesTakenToday = 0

    for (const recharge of todaysRecharges) {
      const amount = parseFloat(String(recharge.amount_bdt))
      if (!Number.isFinite(amount)) continue
      balance += amount
      rechargeTotalToday += amount

      if (!hasPaidFixedChargesThisMonth) {
        fixedChargesTakenToday = FIXED_CHARGES
        balance -= fixedChargesTakenToday
        hasPaidFixedChargesThisMonth = true
      }
    }

    const rawEnergyCost = calculateEnergyCost(dayObj.units, monthRunningUnits)
    const vat = roundTaka(rawEnergyCost * VAT_RATE)
    const totalDailyConsumptionCost = roundTaka(rawEnergyCost + vat)

    balance -= totalDailyConsumptionCost
    monthRunningUnits += dayObj.units

    history.push({
      date: dayObj.date,
      balance: roundTaka(balance),
      rechargeAmount: rechargeTotalToday > 0 ? rechargeTotalToday : null,
      units: dayObj.units,
      rawEnergyCost,
      vat,
      fixedChargesTaken: fixedChargesTakenToday,
      monthRunningUnits,
    })
  }

  return {
    finalBalance: balance,
    history,
    finalState: {
      balance: roundTaka(balance),
      currentMonth,
      monthRunningUnits,
      hasPaidFixedChargesThisMonth,
      date: history[history.length - 1]?.date ?? '',
    },
  }
}

/**
 * Run-out date at usual daily use.
 * Amount to recharge today: energy through the picked date + 5% VAT + ৳82 only if
 * this calendar month has not already taken rent+demand. No extra ৳82 for later months.
 */
export function runPredictions(
  currentState: PredictionState,
  usualDailyUnits: number,
  targetDate: string,
): PredictionResult {
  let { balance, currentMonth, monthRunningUnits, hasPaidFixedChargesThisMonth, date } =
    currentState

  let currentDate = date
  let runOutDate: string | null = null
  const breakdown: PredictionBreakdown = { energy: 0, vat: 0, fixedCharges: 0, slabPenalty: 0 }

  if (!hasPaidFixedChargesThisMonth) {
    breakdown.fixedCharges = FIXED_CHARGES
  }

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
    }

    const energyCost = calculateEnergyCost(usualDailyUnits, monthRunningUnits)
    const vat = roundTaka(energyCost * VAT_RATE)
    const dailyTotal = roundTaka(energyCost + vat)

    if (dateStr <= targetDate) {
      breakdown.energy += energyCost
      breakdown.vat += vat
      breakdown.slabPenalty += energyCost - usualDailyUnits * FIRST_SLAB_RATE
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
  const vat = roundTaka(energy * VAT_RATE)
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
 * Same months and units for both habits. Cost is energy + VAT + ৳82, not deposits.
 * Low balance: top up at start of day when balance is below the threshold.
 * Monthly: top up on the 1st.
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
    daily_units,
  } = comparisonConfig

  const constantUnits =
    typeof daily_units === 'number' && Number.isFinite(daily_units) ? daily_units : null

  const monthSet = new Set(months)
  const simulationDays = days
    .filter((day) => monthSet.has(day.date.substring(0, 7)))
    .map((day) => (constantUnits === null ? day : { ...day, units: constantUnits }))

  const lowThreshold = parseFloat(String(low_threshold_bdt))
  const lowAmount = parseFloat(String(low_amount_bdt))
  const monthlyAmount = parseFloat(String(monthly_amount_bdt))
  const opening = parseFloat(String(opening_balance_bdt))

  const simulate = (isMonthlyHabit: boolean): HabitTotals => {
    let balance = opening
    let currentMonth: string | null = null
    let monthRunningUnits = 0
    let hasPaidFixedChargesThisMonth = false
    let energyAndVat = 0
    let fixedChargesTotal = 0

    for (const day of simulationDays) {
      const monthKey = calendarMonthKey(day.date)

      if (currentMonth !== monthKey) {
        currentMonth = monthKey
        monthRunningUnits = 0
        hasPaidFixedChargesThisMonth = false
      }

      let triggeredRecharge = false
      if (isMonthlyHabit && isFirstDayOfMonth(day.date)) {
        balance += monthlyAmount
        triggeredRecharge = true
      } else if (!isMonthlyHabit && balance < lowThreshold) {
        balance += lowAmount
        triggeredRecharge = true
      }

      if (triggeredRecharge && !hasPaidFixedChargesThisMonth) {
        balance -= FIXED_CHARGES
        fixedChargesTotal = roundTaka(fixedChargesTotal + FIXED_CHARGES)
        hasPaidFixedChargesThisMonth = true
      }

      const energyCost = calculateEnergyCost(day.units, monthRunningUnits)
      const vat = roundTaka(energyCost * VAT_RATE)
      const dailyConsumptionCost = roundTaka(energyCost + vat)

      balance -= dailyConsumptionCost
      energyAndVat = roundTaka(energyAndVat + dailyConsumptionCost)
      monthRunningUnits += day.units
    }

    return {
      cost: roundTaka(energyAndVat + fixedChargesTotal),
      energyAndVat,
      fixedCharges: fixedChargesTotal,
    }
  }

  const low = simulate(false)
  const monthly = simulate(true)

  return {
    lowBalanceCost: low.cost,
    monthlyCost: monthly.cost,
    winner:
      low.cost < monthly.cost ? 'Low Balance' : monthly.cost < low.cost ? 'Monthly' : 'Tie',
    difference: roundTaka(Math.abs(low.cost - monthly.cost)),
    energyAndVat: low.energyAndVat,
    lowBalanceFixedCharges: low.fixedCharges,
    monthlyFixedCharges: monthly.fixedCharges,
  }
}

export type SlabPosition = {
  monthRunningUnits: number
  currentRate: number
  currentSlabLabel: string
  unitsLeftInSlab: number | null
  nextRate: number | null
  nextSlabLabel: string | null
}

export type ClosedShopAdvice = {
  runOutDate: string | null
  weekday: string | null
  shopsLikelyClosed: boolean
  rechargeByDate: string | null
  coverUntilDate: string | null
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

function weekdayIndex(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}

function slabRangeLabel(fromExclusive: number, limit: number, rate: number): string {
  const lower = fromExclusive === 0 ? 1 : fromExclusive + 1
  if (!Number.isFinite(limit)) return `${lower}+ units @ ${rate.toFixed(2)}`
  return `${lower}–${limit} units @ ${rate.toFixed(2)}`
}

/**
 * Where this month's running units sit on the official tariff.
 * After exactly 75 units the next unit is already in slab 2.
 */
export function getSlabPosition(monthRunningUnits: number): SlabPosition {
  const units = Math.max(0, monthRunningUnits)
  let previousLimit = 0

  for (let index = 0; index < TARIFF_SLABS.length; index += 1) {
    const slab = TARIFF_SLABS[index]
    const inThisSlab = !Number.isFinite(slab.limit) || units < slab.limit
    if (!inThisSlab) {
      previousLimit = slab.limit
      continue
    }

    const next = TARIFF_SLABS[index + 1]
    const unitsLeftInSlab = Number.isFinite(slab.limit) ? slab.limit - units : null
    return {
      monthRunningUnits: units,
      currentRate: slab.rate,
      currentSlabLabel: slabRangeLabel(previousLimit, slab.limit, slab.rate),
      unitsLeftInSlab,
      nextRate: next ? next.rate : null,
      nextSlabLabel: next
        ? slabRangeLabel(slab.limit === Infinity ? previousLimit : slab.limit, next.limit, next.rate)
        : null,
    }
  }

  const last = TARIFF_SLABS[TARIFF_SLABS.length - 1]
  const lastFinite = TARIFF_SLABS[TARIFF_SLABS.length - 2]
  return {
    monthRunningUnits: units,
    currentRate: last.rate,
    currentSlabLabel: slabRangeLabel(lastFinite.limit, last.limit, last.rate),
    unitsLeftInSlab: null,
    nextRate: null,
    nextSlabLabel: null,
  }
}

export function daysUntilNextSlab(
  unitsLeftInSlab: number | null,
  usualDailyUnits: number,
): number | null {
  if (unitsLeftInSlab === null || usualDailyUnits <= 0) return null
  return Math.ceil(unitsLeftInSlab / usualDailyUnits)
}

/**
 * Friday and Saturday are the usual weekly holidays in Bangladesh.
 * If run-out falls on one of those days, recharge by Thursday and cover through Sunday.
 */
export function adviseClosedShopRecharge(runOutDate: string | null): ClosedShopAdvice {
  if (!runOutDate) {
    return {
      runOutDate: null,
      weekday: null,
      shopsLikelyClosed: false,
      rechargeByDate: null,
      coverUntilDate: null,
    }
  }

  const day = weekdayIndex(runOutDate)
  const weekday = WEEKDAY_NAMES[day]
  const shopsLikelyClosed = day === 5 || day === 6

  if (!shopsLikelyClosed) {
    return {
      runOutDate,
      weekday,
      shopsLikelyClosed: false,
      rechargeByDate: null,
      coverUntilDate: null,
    }
  }

  const daysBackToThursday = day === 5 ? 1 : 2
  const daysForwardToSunday = day === 5 ? 2 : 1

  return {
    runOutDate,
    weekday,
    shopsLikelyClosed: true,
    rechargeByDate: addCalendarDays(runOutDate, -daysBackToThursday),
    coverUntilDate: addCalendarDays(runOutDate, daysForwardToSunday),
  }
}
