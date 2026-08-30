import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  adviseClosedShopRecharge,
  calendarMonthKey,
  compareHabits,
  daysUntilNextSlab,
  getSlabPosition,
  runPredictions,
  runSimulation,
  type SimulationPoint,
} from './billingEngine'
import household from './data/household.json'
import { buildFamilyPlanText, downloadPlainText } from './familyPlan'

const HOUSEHOLD_JSON = JSON.stringify(household, null, 2)
const MAX_JSON_CHARS = 5_000_000

const SECTIONS = [
  { id: 'household', step: '1', label: 'Household', hint: 'Load readings' },
  { id: 'balance', step: '2', label: 'Balance', hint: 'Day-by-day line' },
  { id: 'questions', step: '3', label: 'Questions', hint: 'Run out & top up' },
  { id: 'habits', step: '4', label: 'Habits', hint: 'Low vs monthly' },
  { id: 'plan', step: 'Bonus', label: 'Plan', hint: 'Stay on this month' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

type MeterDay = {
  date: string
  units: number
}

type MeterRecharge = {
  date: string
  amount_bdt: string | number
}

type ComparisonParams = {
  months: string[]
  opening_balance_bdt: string | number
  low_amount_bdt: string | number
  low_threshold_bdt: string | number
  monthly_amount_bdt: string | number
  source?: string
  daily_units?: number | null
}

type ParsedData = {
  opening_balance_bdt: string | number
  days: MeterDay[]
  recharges: MeterRecharge[]
  today?: string
  usual_daily_units?: number
  target_date?: string
  comparison?: ComparisonParams
}

type TooltipViewProps = {
  active?: boolean
  payload?: Array<{ payload: SimulationPoint }>
  label?: string
}

type HouseholdFacts = {
  monthCount: number
  lightMonth: string
  lightUnits: number
  heavyMonth: string
  heavyUnits: number
  lastWeekRecharge: { date: string; amount: number } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseComparison(value: unknown): ComparisonParams | undefined {
  if (!isRecord(value)) return undefined
  const months = Array.isArray(value.months)
    ? value.months.map((month) => String(month))
    : []
  return {
    months,
    opening_balance_bdt: (value.opening_balance_bdt as string | number) ?? '0.00',
    low_amount_bdt: value.low_amount_bdt as string | number,
    low_threshold_bdt: value.low_threshold_bdt as string | number,
    monthly_amount_bdt: value.monthly_amount_bdt as string | number,
    source: typeof value.source === 'string' ? value.source : undefined,
    daily_units: typeof value.daily_units === 'number' ? value.daily_units : null,
  }
}

function extractCase(raw: unknown): ParsedData {
  if (!isRecord(raw)) {
    throw new Error('Invalid format: Root value must be a JSON object.')
  }

  if (Array.isArray(raw.cases) && raw.cases.length === 0) {
    throw new Error('Invalid format: cases array is empty.')
  }

  const source = Array.isArray(raw.cases) ? raw.cases[0] : raw
  if (!isRecord(source)) {
    throw new Error('Invalid format: Missing a household case object.')
  }

  if (
    source.opening_balance_bdt === undefined ||
    !Array.isArray(source.days) ||
    !Array.isArray(source.recharges)
  ) {
    throw new Error('Invalid format: Missing opening_balance_bdt, days, or recharges.')
  }

  return {
    opening_balance_bdt: source.opening_balance_bdt as string | number,
    days: source.days as MeterDay[],
    recharges: source.recharges as MeterRecharge[],
    usual_daily_units:
      typeof source.usual_daily_units === 'number' ? source.usual_daily_units : undefined,
    today: typeof source.today === 'string' ? source.today : undefined,
    target_date: typeof source.target_date === 'string' ? source.target_date : undefined,
    comparison: parseComparison(source.comparison),
  }
}

function formatBdt(value: number | string | undefined): string {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return '—'
  return `${amount.toLocaleString('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} BDT`
}

function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return 'Does not run out within a year'
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function monthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

function lastDayOfMonth(isoDate: string): number {
  const [year, month] = isoDate.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

function summarizeHousehold(data: ParsedData): HouseholdFacts | null {
  const unitsByMonth = new Map<string, number>()
  for (const day of data.days) {
    const key = day.date.slice(0, 7)
    unitsByMonth.set(key, (unitsByMonth.get(key) ?? 0) + day.units)
  }
  const months = [...unitsByMonth.keys()].sort()
  if (!months.length) return null

  let lightMonth = months[0]
  let heavyMonth = months[0]
  for (const month of months) {
    const units = unitsByMonth.get(month) ?? 0
    if (units < (unitsByMonth.get(lightMonth) ?? Infinity)) lightMonth = month
    if (units > (unitsByMonth.get(heavyMonth) ?? -1)) heavyMonth = month
  }

  let lastWeekRecharge: { date: string; amount: number } | null = null
  for (const recharge of data.recharges) {
    const day = Number(recharge.date.slice(8, 10))
    if (day <= lastDayOfMonth(recharge.date) - 7) continue
    const amount = Number(recharge.amount_bdt)
    if (!Number.isFinite(amount)) continue
    if (!lastWeekRecharge || amount > lastWeekRecharge.amount) {
      lastWeekRecharge = { date: recharge.date, amount }
    }
  }

  return {
    monthCount: months.length,
    lightMonth,
    lightUnits: unitsByMonth.get(lightMonth) ?? 0,
    heavyMonth,
    heavyUnits: unitsByMonth.get(heavyMonth) ?? 0,
    lastWeekRecharge,
  }
}

function NeedHousehold({ onGo }: { onGo: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-canvas/60 px-6 py-10 text-center">
      <p className="text-sm text-muted">Start on Household and load readings first.</p>
      <button
        type="button"
        onClick={onGo}
        className="mt-4 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        Go to Household
      </button>
    </div>
  )
}

function CustomTooltip({ active, payload, label }: TooltipViewProps) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-sm text-surface shadow-lg">
      <p>{label}</p>
      <p className="font-medium">{formatBdt(data.balance)}</p>
      {data.rechargeAmount ? <p>Recharge {formatBdt(data.rechargeAmount)}</p> : null}
    </div>
  )
}

export default function App() {
  const [section, setSection] = useState<SectionId>('household')
  const [jsonInput, setJsonInput] = useState('')
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [error, setError] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const applyCase = (data: ParsedData) => {
    setError('')
    setParsedData(data)
    setTargetDate(data.target_date ?? '')
  }

  const handleLoadData = () => {
    setError('')
    try {
      if (!jsonInput.trim()) throw new Error('Paste JSON first, or load the six-month household.')
      if (jsonInput.length > MAX_JSON_CHARS) {
        throw new Error('JSON is too large to parse in the browser.')
      }
      applyCase(extractCase(JSON.parse(jsonInput) as unknown))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not parse JSON.')
      setParsedData(null)
    }
  }

  const handleLoadHousehold = () => {
    setJsonInput(HOUSEHOLD_JSON)
    try {
      applyCase(extractCase(household))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load household.')
      setParsedData(null)
    }
  }

  const simulation = useMemo(() => {
    if (!parsedData) return null
    return runSimulation(
      parsedData.days,
      parsedData.recharges,
      parsedData.opening_balance_bdt,
    )
  }, [parsedData])

  const chartData = simulation?.history ?? []
  const facts = useMemo(() => (parsedData ? summarizeHousehold(parsedData) : null), [parsedData])

  const habitResult = useMemo(() => {
    if (!parsedData?.comparison) return null
    return compareHabits(parsedData.days, parsedData.comparison)
  }, [parsedData])

  const comparison = parsedData?.comparison
  const todayRow =
    simulation?.history.find((row) => row.date === parsedData?.today) ??
    simulation?.history[simulation.history.length - 1]
  const todayBalance = todayRow?.balance ?? simulation?.finalState.balance

  const predictionState = useMemo(() => {
    if (!parsedData || !simulation?.history.length || !todayRow) return null
    const today = parsedData.today ?? todayRow.date
    const paidThisMonth = simulation.history
      .filter((row) => row.date.substring(0, 7) === today.substring(0, 7))
      .some((row) => row.fixedChargesTaken > 0)
    return {
      balance: todayRow.balance,
      date: today,
      currentMonth: calendarMonthKey(today),
      monthRunningUnits: todayRow.monthRunningUnits,
      hasPaidFixedChargesThisMonth: paidThisMonth,
    }
  }, [parsedData, simulation, todayRow])

  const predictions = useMemo(() => {
    if (!parsedData || !predictionState || parsedData.usual_daily_units === undefined) return null
    return runPredictions(
      predictionState,
      parsedData.usual_daily_units,
      targetDate || predictionState.date,
    )
  }, [parsedData, predictionState, targetDate])

  const slab = getSlabPosition(todayRow?.monthRunningUnits ?? 0)
  const usualDailyUnits = parsedData?.usual_daily_units
  const slabDays = daysUntilNextSlab(slab.unitsLeftInSlab, usualDailyUnits ?? 0)
  const shopAdvice = adviseClosedShopRecharge(predictions?.runOutDate ?? null)
  const coverUntilDate = shopAdvice.coverUntilDate

  const weekendCover =
    predictionState && usualDailyUnits !== undefined && coverUntilDate
      ? runPredictions(predictionState, usualDailyUnits, coverUntilDate)
      : null

  const handleDownloadPlan = () => {
    if (!parsedData || !facts) return
    const text = buildFamilyPlanText({
      generatedOn: new Date().toISOString().slice(0, 10),
      monthCount: facts.monthCount,
      lightMonth: monthLabel(facts.lightMonth),
      lightUnits: facts.lightUnits,
      heavyMonth: monthLabel(facts.heavyMonth),
      heavyUnits: facts.heavyUnits,
      lastWeekRecharge: facts.lastWeekRecharge
        ? `${facts.lastWeekRecharge.amount.toFixed(2)} BDT on ${facts.lastWeekRecharge.date}`
        : 'None',
      todayBalance: todayBalance ?? 0,
      usualDailyUnits: parsedData.usual_daily_units,
      runOutDate: predictions?.runOutDate,
      targetDate,
      amountNeededToday: predictions?.amountNeededToday,
      breakdown: predictions?.breakdown,
      habitWinner: habitResult?.winner ?? null,
      habitDifference: habitResult?.difference ?? null,
      lowBalanceCost: habitResult?.lowBalanceCost ?? null,
      monthlyCost: habitResult?.monthlyCost ?? null,
      slab,
      daysUntilNextSlab: slabDays,
      shop: shopAdvice,
      weekendCoverAmount: weekendCover?.amountNeededToday ?? null,
    })
    downloadPlainText('meterwise-family-plan.txt', text)
  }

  return (
    <div className="flex min-h-screen flex-col text-ink">
      <header className="border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M13 3L6 13h5l-1 8 8-11h-5l1-7z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <div>
                <p className="font-display text-xl font-semibold tracking-tight">MeterWise</p>
                <p className="text-xs text-muted">Prepaid meter recharge advisor</p>
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                parsedData
                  ? 'bg-brand-soft text-brand-dark'
                  : 'bg-alert-soft text-alert'
              }`}
            >
              {parsedData ? 'Household loaded' : 'Waiting for household'}
            </span>
          </div>

          <p className="text-sm text-muted">
            Four required steps in order, then Plan: stay below the next tariff slab and recharge
            before Friday if the meter would otherwise run out when shops are closed.
          </p>

          <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="Sections">
            {SECTIONS.map((item) => {
              const active = section === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                    active
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-surface hover:border-brand/40'
                  }`}
                >
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
                    {item.step}
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{item.hint}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {section === 'household' ? (
          <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
              Dhaka · prepaid electricity
            </p>
            <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight">Household</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Click <span className="font-medium text-ink">Load 6-month household</span> for the
              built-in family (light January, heavy May, ৳5,000 on 28 June). Or paste a judge case
              and load that instead.
            </p>
            <textarea
              className="mt-5 h-32 w-full resize-y rounded-2xl border border-line bg-canvas/70 p-4 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
              placeholder='Paste JSON here, or use “Load 6-month household”.'
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
            />
            {error ? <p className="mt-3 text-sm text-alert">{error}</p> : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleLoadHousehold}
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Load 6-month household
              </button>
              <button
                type="button"
                onClick={handleLoadData}
                className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium hover:border-ink/30"
              >
                Load pasted JSON
              </button>
            </div>
            {facts ? (
              <div className="mt-6 border-t border-line pt-6">
                <p className="text-sm font-medium text-brand-dark">This household is ready.</p>
                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl bg-canvas/80 p-4">
                    <dt className="text-muted">Months</dt>
                    <dd className="mt-1 text-lg font-semibold">{facts.monthCount}</dd>
                  </div>
                  <div className="rounded-2xl bg-canvas/80 p-4">
                    <dt className="text-muted">Light month</dt>
                    <dd className="mt-1 text-lg font-semibold">
                      {monthLabel(facts.lightMonth)} · {facts.lightUnits} units
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-canvas/80 p-4">
                    <dt className="text-muted">Heavy month</dt>
                    <dd className="mt-1 text-lg font-semibold">
                      {monthLabel(facts.heavyMonth)} · {facts.heavyUnits} units
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-canvas/80 p-4">
                    <dt className="text-muted">Last-week recharge</dt>
                    <dd className="mt-1 text-lg font-semibold">
                      {facts.lastWeekRecharge
                        ? `${formatBdt(facts.lastWeekRecharge.amount)} on ${formatLongDate(facts.lastWeekRecharge.date)}`
                        : 'None'}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => setSection('balance')}
                  className="mt-5 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
                >
                  Next: Balance
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {section === 'balance' ? (
          <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <h2 className="font-display text-3xl font-semibold tracking-tight">Day-by-day balance</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Each day is priced at the month’s running slab. ৳82 (rent + demand) on the first
              recharge of a month. 5% VAT on energy only. Green marks are recharges — hover one to
              read the amount.
            </p>
            <div className="mt-6 h-[420px] w-full">
              {parsedData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4dfd4" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#5c6358', fontSize: 12 }}
                      tickFormatter={(value: string) => value.slice(5)}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fill: '#5c6358', fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    {chartData
                      .filter((point) => point.rechargeAmount)
                      .map((point) => (
                        <ReferenceLine
                          key={`recharge-line-${point.date}`}
                          x={point.date}
                          stroke="#0f9f6e"
                          strokeDasharray="3 3"
                          strokeOpacity={0.45}
                        />
                      ))}
                    <Line
                      type="stepAfter"
                      dataKey="balance"
                      stroke="#17211a"
                      strokeWidth={2}
                      activeDot={{ r: 5, fill: '#0b6e4f', stroke: '#fff' }}
                      dot={(props) => {
                        const { cx, cy, payload, index } = props as {
                          cx?: number
                          cy?: number
                          index?: number
                          payload?: SimulationPoint
                        }
                        if (!payload?.rechargeAmount || cx === undefined || cy === undefined) {
                          return <g key={`dot-${index ?? payload?.date ?? 'x'}`} />
                        }
                        return (
                          <circle
                            key={`recharge-${payload.date}`}
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill="#0f9f6e"
                            stroke="#fff"
                            strokeWidth={2}
                          />
                        )
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <NeedHousehold onGo={() => setSection('household')} />
              )}
            </div>
            {parsedData ? (
              <button
                type="button"
                onClick={() => setSection('questions')}
                className="mt-6 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Next: Questions
              </button>
            ) : null}
          </section>
        ) : null}

        {section === 'questions' ? (
          <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <h2 className="font-display text-3xl font-semibold tracking-tight">Two questions</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Left: when today’s rebuilt balance runs out at usual daily use. Right: pick a date,
              then see how much to recharge today, split into energy, higher slab, fixed charges,
              and VAT.
            </p>
            {!parsedData ? (
              <div className="mt-6">
                <NeedHousehold onGo={() => setSection('household')} />
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-alert/20 bg-alert-soft p-5">
                    <p className="text-sm font-medium text-alert">When does the balance run out?</p>
                    <p className="mt-1 text-xs text-muted">
                      Today {formatBdt(todayBalance)} · {parsedData.usual_daily_units ?? '—'} units/day
                    </p>
                    <p className="mt-4 font-display text-3xl font-semibold text-ink">
                      {formatLongDate(predictions?.runOutDate)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand/20 bg-brand-soft p-5">
                    <p className="text-sm font-medium text-brand-dark">
                      How much to recharge today to last until
                    </p>
                    <input
                      id="target-date"
                      type="date"
                      value={targetDate}
                      min={parsedData.today}
                      onChange={(event) => setTargetDate(event.target.value)}
                      className="mt-3 w-full rounded-xl border border-brand/20 bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                    />
                    <p className="mt-4 font-display text-3xl font-semibold text-ink">
                      {targetDate ? formatBdt(predictions?.amountNeededToday) : 'Pick a date'}
                    </p>
                    {targetDate ? (
                      <dl className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted">Energy</dt>
                          <dd>{formatBdt(predictions?.breakdown.energy)}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted">Higher slab</dt>
                          <dd>{formatBdt(predictions?.breakdown.slabPenalty)}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted">Fixed charges</dt>
                          <dd>{formatBdt(predictions?.breakdown.fixedCharges)}</dd>
                        </div>
                        <div className="flex justify-between gap-4 border-t border-brand/20 pt-2">
                          <dt className="text-muted">VAT</dt>
                          <dd>{formatBdt(predictions?.breakdown.vat)}</dd>
                        </div>
                      </dl>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSection('habits')}
                  className="mt-6 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
                >
                  Next: Habits
                </button>
              </>
            )}
          </section>
        ) : null}

        {section === 'habits' ? (
          <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <h2 className="font-display text-3xl font-semibold tracking-tight">Two habits</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Same three months
              {comparison?.months.length ? ` (${comparison.months.join(', ')})` : ''}, same daily
              units. Cost is energy + VAT + ৳82 when a month takes a recharge — not the money
              deposited. A tie is allowed. Any gap is only how often ৳82 was taken.
            </p>
            {!parsedData ? (
              <div className="mt-6">
                <NeedHousehold onGo={() => setSection('household')} />
              </div>
            ) : !habitResult ? (
              <p className="mt-6 text-sm text-muted">This household has no comparison months.</p>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-brand-soft px-5 py-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-brand-dark">
                    Which costs less
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold">
                    {habitResult.winner === 'Tie'
                      ? `Same cost: ${formatBdt(habitResult.lowBalanceCost)}`
                      : habitResult.winner === 'Low Balance'
                        ? `Low balance costs less by ${formatBdt(habitResult.difference)}`
                        : `Start of month costs less by ${formatBdt(habitResult.difference)}`}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-line p-5">
                    <h3 className="font-medium">When the balance runs low</h3>
                    <p className="mt-1 text-sm text-muted">
                      At the start of the day, if balance is below {comparison?.low_threshold_bdt ?? '—'},
                      recharge {comparison?.low_amount_bdt ?? '—'}.
                    </p>
                    <p className="mt-4 font-display text-3xl font-semibold">
                      {formatBdt(habitResult.lowBalanceCost)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-line p-5">
                    <h3 className="font-medium">Start of each month</h3>
                    <p className="mt-1 text-sm text-muted">
                      Recharge {comparison?.monthly_amount_bdt ?? '—'} on the 1st of each month.
                    </p>
                    <p className="mt-4 font-display text-3xl font-semibold">
                      {formatBdt(habitResult.monthlyCost)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSection('plan')}
                  className="mt-6 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
                >
                  Next: Plan
                </button>
              </div>
            )}
          </section>
        ) : null}

        {section === 'plan' ? (
          <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-dark">
              Bonus · not one of the four required items
            </p>
            <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight">Stay-on plan</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Prepaid meters go dark the hour the balance hits zero, and many recharge shops close
              Friday–Saturday. This page uses the same engine as the required tabs: how close this
              month is to the next more expensive slab, and when to top up so the family is not
              without power over the weekly holiday.
            </p>
            {!parsedData ? (
              <div className="mt-6">
                <NeedHousehold onGo={() => setSection('household')} />
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-line bg-canvas/80 p-5">
                    <p className="text-sm font-medium">This month’s tariff slab</p>
                    <p className="mt-1 text-xs text-muted">
                      {todayRow?.monthRunningUnits ?? 0} units used so far this calendar month
                    </p>
                    <p className="mt-4 font-display text-2xl font-semibold">{slab.currentSlabLabel}</p>
                    {slab.unitsLeftInSlab === null ? (
                      <p className="mt-3 text-sm text-muted">Already on the highest published slab.</p>
                    ) : (
                      <dl className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted">Units left in this slab</dt>
                          <dd className="font-medium">{slab.unitsLeftInSlab}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted">Days at usual use until the next slab</dt>
                          <dd className="font-medium">{slabDays ?? '—'}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted">Next slab</dt>
                          <dd className="font-medium">{slab.nextSlabLabel}</dd>
                        </div>
                      </dl>
                    )}
                  </div>
                  <div
                    className={`rounded-2xl border p-5 ${
                      shopAdvice.shopsLikelyClosed
                        ? 'border-alert/20 bg-alert-soft'
                        : 'border-brand/20 bg-brand-soft'
                    }`}
                  >
                    <p className="text-sm font-medium">Friday–Saturday shop closure</p>
                    <p className="mt-4 font-display text-2xl font-semibold text-ink">
                      {shopAdvice.weekday
                        ? `Run-out is ${shopAdvice.weekday}`
                        : 'No run-out within a year'}
                    </p>
                    {shopAdvice.shopsLikelyClosed ? (
                      <dl className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted">Recharge by</dt>
                          <dd>{formatLongDate(shopAdvice.rechargeByDate)}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted">Cover through</dt>
                          <dd>{formatLongDate(shopAdvice.coverUntilDate)}</dd>
                        </div>
                        <div className="flex justify-between gap-4 border-t border-alert/20 pt-2">
                          <dt className="text-muted">Amount today for those days</dt>
                          <dd>{formatBdt(weekendCover?.amountNeededToday)}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="mt-3 text-sm text-muted">
                        Run-out is not on the weekly holiday. Still recharge before the balance hits
                        zero — the meter cuts power the same day.
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={handleDownloadPlan}
                    className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
                  >
                    Download family plan
                  </button>
                  <p className="text-xs text-muted">
                    Saves a plain-text file on this device. Nothing is uploaded.
                  </p>
                </div>
              </>
            )}
          </section>
        ) : null}
      </main>
    </div>
  )
}
