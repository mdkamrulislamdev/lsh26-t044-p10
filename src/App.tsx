import { useEffect, useMemo, useState } from 'react'
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
  calendarMonthKey,
  compareHabits,
  runPredictions,
  runSimulation,
  type SimulationPoint,
} from './billingEngine'
import household from './data/household.json'

const HOUSEHOLD_JSON = JSON.stringify(household, null, 2)

const SECTIONS = [
  { id: 'household', label: 'Household' },
  { id: 'balance', label: 'Balance' },
  { id: 'questions', label: 'Questions' },
  { id: 'habits', label: 'Habits' },
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

function CustomTooltip({ active, payload, label }: TooltipViewProps) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white shadow-lg">
      <p>{label}</p>
      <p className="font-mono">{formatBdt(data.balance)}</p>
      {data.rechargeAmount ? <p>Recharge {formatBdt(data.rechargeAmount)}</p> : null}
    </div>
  )
}

function NeedHousehold() {
  return <p className="text-sm text-slate-500">Load a household first.</p>
}

export default function App() {
  const [section, setSection] = useState<SectionId>('household')
  const [jsonInput, setJsonInput] = useState('')
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [error, setError] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const handleLoadData = () => {
    setError('')
    try {
      if (!jsonInput.trim()) throw new Error('Input is empty.')
      const data: unknown = JSON.parse(jsonInput)
      setParsedData(extractCase(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not parse JSON.')
      setParsedData(null)
    }
  }

  const handleLoadHousehold = () => {
    setJsonInput(HOUSEHOLD_JSON)
    setError('')
    try {
      setParsedData(extractCase(household))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load household.')
      setParsedData(null)
    }
  }

  useEffect(() => {
    setTargetDate(parsedData?.target_date ?? '')
  }, [parsedData])

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

  const predictions = useMemo(() => {
    if (!parsedData || !simulation?.history.length) return null
    if (parsedData.usual_daily_units === undefined || !targetDate) return null

    const todayState =
      simulation.history.find((row) => row.date === parsedData.today) ??
      simulation.history[simulation.history.length - 1]
    const today = parsedData.today ?? todayState.date
    const paidThisMonth = simulation.history
      .filter((row) => row.date.substring(0, 7) === today.substring(0, 7))
      .some((row) => row.fixedChargesTaken > 0)

    return runPredictions(
      {
        balance: todayState.balance,
        date: today,
        currentMonth: calendarMonthKey(today),
        monthRunningUnits: todayState.monthRunningUnits,
        hasPaidFixedChargesThisMonth: paidThisMonth,
      },
      parsedData.usual_daily_units,
      targetDate,
    )
  }, [parsedData, simulation, targetDate])

  const habitResult = useMemo(() => {
    if (!parsedData?.comparison) return null
    return compareHabits(parsedData.days, parsedData.comparison)
  }, [parsedData])

  const comparison = parsedData?.comparison
  const todayBalance = simulation?.history.find((row) => row.date === parsedData?.today)?.balance
    ?? simulation?.finalState.balance

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold text-slate-900">Prepaid meter</h1>
          <nav className="flex flex-wrap gap-2" aria-label="Sections">
            {SECTIONS.map((item) => {
              const active = section === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {section === 'household' ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Household</h2>
            <p className="mt-1 text-sm text-slate-600">
              Six months of daily units, with a light month, a heavy summer month, and a large
              recharge in the last week of a month.
            </p>
            <textarea
              className="mt-4 h-28 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Or paste household JSON"
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
            />
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleLoadHousehold}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Load 6-month household
              </button>
              <button
                type="button"
                onClick={handleLoadData}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:border-slate-800"
              >
                Load pasted JSON
              </button>
            </div>
            {facts ? (
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Months</dt>
                  <dd className="font-medium text-slate-900">{facts.monthCount}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Light month</dt>
                  <dd className="font-medium text-slate-900">
                    {monthLabel(facts.lightMonth)} · {facts.lightUnits} units
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Heavy month</dt>
                  <dd className="font-medium text-slate-900">
                    {monthLabel(facts.heavyMonth)} · {facts.heavyUnits} units
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Last-week recharge</dt>
                  <dd className="font-medium text-slate-900">
                    {facts.lastWeekRecharge
                      ? `${formatBdt(facts.lastWeekRecharge.amount)} on ${formatLongDate(facts.lastWeekRecharge.date)}`
                      : 'None'}
                  </dd>
                </div>
              </dl>
            ) : null}
          </section>
        ) : null}

        {section === 'balance' ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Day-by-day balance</h2>
            <p className="mt-1 text-sm text-slate-600">
              Each day’s units at the month’s running slab. Demand charge and meter rent on the
              first recharge of the month. VAT on energy. Green marks are recharges.
            </p>
            <div className="mt-4 h-[420px] w-full">
              {parsedData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickFormatter={(value: string) => value.slice(5)}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    {chartData
                      .filter((point) => point.rechargeAmount)
                      .map((point) => (
                        <ReferenceLine
                          key={`recharge-line-${point.date}`}
                          x={point.date}
                          stroke="#10b981"
                          strokeDasharray="3 3"
                          strokeOpacity={0.45}
                        />
                      ))}
                    <Line
                      type="stepAfter"
                      dataKey="balance"
                      stroke="#0f172a"
                      strokeWidth={2}
                      activeDot={{ r: 5, fill: '#0f172a', stroke: '#fff' }}
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
                            fill="#10b981"
                            stroke="#fff"
                            strokeWidth={2}
                          />
                        )
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <NeedHousehold />
              )}
            </div>
          </section>
        ) : null}

        {section === 'questions' ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Two questions</h2>
            {!parsedData ? (
              <div className="mt-4">
                <NeedHousehold />
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm text-slate-600">When does the balance run out?</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Today {formatBdt(todayBalance)} · {parsedData.usual_daily_units ?? '—'} units/day
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">
                    {formatLongDate(predictions?.runOutDate)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm text-slate-600">How much to recharge today to last until</p>
                  <input
                    id="target-date"
                    type="date"
                    value={targetDate}
                    min={parsedData.today}
                    onChange={(event) => setTargetDate(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <p className="mt-3 text-2xl font-semibold text-slate-900">
                    {targetDate ? formatBdt(predictions?.amountNeededToday) : 'Pick a date'}
                  </p>
                  {targetDate ? (
                    <dl className="mt-3 space-y-1 text-sm text-slate-700">
                      <div className="flex justify-between gap-4">
                        <dt>Energy</dt>
                        <dd>{formatBdt(predictions?.breakdown.energy)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Higher slab</dt>
                        <dd>{formatBdt(predictions?.breakdown.slabPenalty)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Fixed charges</dt>
                        <dd>{formatBdt(predictions?.breakdown.fixedCharges)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>VAT</dt>
                        <dd>{formatBdt(predictions?.breakdown.vat)}</dd>
                      </div>
                    </dl>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        ) : null}

        {section === 'habits' ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Two habits</h2>
            <p className="mt-1 text-sm text-slate-600">
              Same three months
              {comparison?.months.length ? ` (${comparison.months.join(', ')})` : ''}, same
              consumption.
            </p>
            {!parsedData ? (
              <div className="mt-4">
                <NeedHousehold />
              </div>
            ) : !habitResult ? (
              <p className="mt-4 text-sm text-slate-500">This household has no comparison months.</p>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-lg font-semibold text-slate-900">
                  {habitResult.winner === 'Tie'
                    ? `Same cost: ${formatBdt(habitResult.lowBalanceCost)}`
                    : habitResult.winner === 'Low Balance'
                      ? `Low balance costs less by ${formatBdt(habitResult.difference)}`
                      : `Start of month costs less by ${formatBdt(habitResult.difference)}`}
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="font-medium text-slate-900">When the balance runs low</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Recharge {comparison?.low_amount_bdt ?? '—'} when below{' '}
                      {comparison?.low_threshold_bdt ?? '—'}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-slate-900">
                      {formatBdt(habitResult.lowBalanceCost)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="font-medium text-slate-900">Start of each month</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Recharge {comparison?.monthly_amount_bdt ?? '—'} on the 1st
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-slate-900">
                      {formatBdt(habitResult.monthlyCost)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  )
}
