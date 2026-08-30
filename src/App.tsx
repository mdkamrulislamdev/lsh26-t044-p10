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
  DEMAND_CHARGE,
  METER_RENT,
  runPredictions,
  runSimulation,
  type SimulationPoint,
} from './billingEngine'
import household from './data/household.json'

const HOUSEHOLD_JSON = JSON.stringify(household, null, 2)

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

function CustomTooltip({ active, payload, label }: TooltipViewProps) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="rounded-lg bg-slate-800 p-3 text-sm text-white shadow-lg">
      <p className="mb-1 font-bold text-slate-300">{label}</p>
      <p>
        Balance: <span className="font-mono text-amber-400">{formatBdt(data.balance)}</span>
      </p>
      <p className="mt-1 text-slate-300">
        {data.units} units · month total {data.monthRunningUnits}
      </p>
      <p className="text-slate-300">Energy {formatBdt(data.rawEnergyCost)} · VAT {formatBdt(data.vat)}</p>
      {data.fixedChargesTaken > 0 ? (
        <p className="text-amber-300">First recharge this month: −{formatBdt(data.fixedChargesTaken)} rent+demand</p>
      ) : null}
      {data.rechargeAmount ? (
        <p className="mt-1 font-bold text-green-400">+ Recharge: {formatBdt(data.rechargeAmount)}</p>
      ) : null}
    </div>
  )
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

export default function App() {
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
  const monthsLabel = comparison?.months.join(' · ') ?? ''
  const monthlyWins = habitResult?.winner === 'Monthly'
  const lowWins = habitResult?.winner === 'Low Balance'
  const isTie = habitResult?.winner === 'Tie'
  const fixedCharge = METER_RENT + DEMAND_CHARGE
  const fixedSteps =
    habitResult && habitResult.difference > 0
      ? Math.round(habitResult.difference / fixedCharge)
      : 0

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <svg
            className="h-6 w-6 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Meter Advisor</h1>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        <section className="col-span-1 flex flex-col gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center justify-between text-sm font-bold uppercase tracking-wider text-slate-500">
              Data Input
              {parsedData ? (
                <span className="rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-600">
                  Loaded ✓
                </span>
              ) : null}
            </h2>
            <textarea
              className="mb-3 h-32 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Paste JSON here, or load the six-month Dhaka household."
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
            />
            {error ? <p className="mb-3 text-xs font-medium text-red-500">{error}</p> : null}
            <p className="mb-3 text-xs leading-5 text-slate-500">
              Built-in household HH-DHAKA-01: Jan–Jun 2026 daily units (light January, heavy May),
              plus a 5,000 BDT top-up on 28 Jun (last week of the month).
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleLoadHousehold}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 transition-colors hover:border-slate-800"
              >
                Load 6-month household
              </button>
              <button
                type="button"
                onClick={handleLoadData}
                className="w-full rounded-lg bg-slate-800 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-900"
              >
                Load Data
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
              Forecast
            </h2>
            {!parsedData ? (
              <div className="flex h-32 items-center justify-center rounded-lg bg-slate-50/50 text-sm text-slate-400">
                Load data to see predictions.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">
                    Date Balance Runs Out
                  </p>
                  <p className="mb-2 text-sm text-slate-700">
                    Today&apos;s rebuilt balance, then {parsedData.usual_daily_units ?? '—'} usual
                    units/day (slab resets on the 1st):
                  </p>
                  <p className="text-2xl font-bold text-red-700">{formatLongDate(predictions?.runOutDate)}</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
                    Amount Needed Today (BDT)
                  </p>
                  <label className="mb-2 block text-sm text-slate-700" htmlFor="target-date">
                    Last until a date you pick
                    <input
                      id="target-date"
                      type="date"
                      value={targetDate}
                      min={parsedData.today}
                      onChange={(event) => setTargetDate(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </label>
                  <p className="mb-3 text-2xl font-bold text-blue-700">
                    {formatBdt(predictions?.amountNeededToday ?? 0)}
                  </p>
                  <p className="mb-2 text-xs text-slate-600">
                    One top-up today. Fixed charges (৳82) only if this calendar month has not already
                    taken rent+demand. Later months in this path add no extra ৳82.
                  </p>
                  <div className="space-y-1 rounded bg-white/60 p-2 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Energy:</span> <span>{formatBdt(predictions?.breakdown.energy ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Higher-slab extra:</span>{' '}
                      <span>{formatBdt(predictions?.breakdown.slabPenalty ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fixed charges (rent + demand):</span>{' '}
                      <span>{formatBdt(predictions?.breakdown.fixedCharges ?? 0)}</span>
                    </div>
                    <div className="mt-1 flex justify-between border-t border-blue-200 pt-1 font-semibold">
                      <span>VAT (5% of energy):</span>{' '}
                      <span>{formatBdt(predictions?.breakdown.vat ?? 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="col-span-1 flex flex-col gap-6 lg:col-span-2">
          <div className="flex min-h-[400px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Rebuilt meter balance
            </h2>
            <p className="mb-3 mt-1 text-xs leading-5 text-slate-500">
              Each day: units priced at this month’s running slab, 5% VAT on energy, and ৳82
              (rent 40 + demand 42) on the first recharge of that calendar month. Green marks are
              recharges. A recharge does not reset the slab counter.
            </p>
            <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-6 bg-slate-900" />
                Daily balance
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                Recharge
              </span>
            </div>
            <div className="h-full min-h-[300px] w-full flex-1">
              {parsedData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickFormatter={(value: string) => value.slice(5)}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
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
                      activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff' }}
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
                <div className="flex h-full items-center justify-center rounded-lg bg-slate-50/50 text-sm text-slate-400">
                  Load data to see chart.
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-[200px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Two recharge habits
            </h2>
            <p className="mb-4 mt-1 text-xs leading-5 text-slate-500">
              Same three months, same daily units and slab counter. Cost is energy + 5% VAT + ৳82
              on the first recharge of a calendar month — not the money deposited.
              {comparison ? ` Window: ${monthsLabel}.` : ''}
            </p>
            {!parsedData ? (
              <div className="flex flex-1 items-center justify-center rounded-lg bg-slate-50/50 text-sm text-slate-400">
                Load data to compare habits.
              </div>
            ) : !habitResult ? (
              <div className="flex flex-1 items-center justify-center rounded-lg bg-slate-50/50 text-sm text-slate-400">
                This case has no comparison months.
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-4">
                <div
                  className={`rounded-lg border p-4 ${
                    isTie
                      ? 'border-slate-200 bg-slate-50'
                      : 'border-emerald-200 bg-emerald-50'
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Which costs less
                  </p>
                  <p
                    className={`mt-1 text-lg font-bold ${
                      isTie ? 'text-slate-800' : 'text-emerald-800'
                    }`}
                  >
                    {isTie
                      ? `Tie — both cost ${formatBdt(habitResult.lowBalanceCost)}`
                      : lowWins
                        ? `Low-balance costs less by ${formatBdt(habitResult.difference)}`
                        : `Start-of-month costs less by ${formatBdt(habitResult.difference)}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {isTie
                      ? 'They paid meter rent + demand the same number of times. A tie is allowed.'
                      : `That gap is ${fixedSteps} × ৳82 (rent + demand), not extra electricity. Shared energy + VAT: ${formatBdt(habitResult.energyAndVat)}.`}
                  </p>
                </div>
                <div className="flex flex-1 flex-col gap-4 md:flex-row">
                <div
                  className={`relative flex-1 overflow-hidden rounded-lg border p-4 ${
                    lowWins
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {lowWins ? (
                    <div className="absolute top-0 right-0 rounded-bl-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-white">
                      COSTS LESS
                    </div>
                  ) : null}
                  {isTie ? (
                    <div className="absolute top-0 right-0 rounded-bl-lg bg-slate-500 px-3 py-1 text-xs font-bold text-white">
                      TIE
                    </div>
                  ) : null}
                  <h3 className={`mb-1 font-bold ${lowWins ? 'text-emerald-900' : 'text-slate-800'}`}>
                    When the balance runs low
                  </h3>
                  <p className={`mb-4 text-xs ${lowWins ? 'text-emerald-700/70' : 'text-slate-500'}`}>
                    At the start of the day, if balance is below {comparison?.low_threshold_bdt ?? '—'}{' '}
                    BDT, recharge {comparison?.low_amount_bdt ?? '—'} BDT.
                  </p>
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Billed cost</p>
                  <div className={`mb-1 text-3xl font-bold ${lowWins ? 'text-emerald-700' : 'text-slate-800'}`}>
                    {formatBdt(habitResult.lowBalanceCost)}
                  </div>
                  <p className="text-xs text-slate-500">
                    Fixed charges {formatBdt(habitResult.lowBalanceFixedCharges)} · energy + VAT{' '}
                    {formatBdt(habitResult.energyAndVat)}
                  </p>
                </div>

                <div
                  className={`relative flex-1 overflow-hidden rounded-lg border p-4 ${
                    monthlyWins ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  {monthlyWins ? (
                    <div className="absolute top-0 right-0 rounded-bl-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-white">
                      COSTS LESS
                    </div>
                  ) : null}
                  {isTie ? (
                    <div className="absolute top-0 right-0 rounded-bl-lg bg-slate-500 px-3 py-1 text-xs font-bold text-white">
                      TIE
                    </div>
                  ) : null}
                  <h3 className={`mb-1 font-bold ${monthlyWins ? 'text-emerald-900' : 'text-slate-800'}`}>
                    Start of each month
                  </h3>
                  <p className={`mb-4 text-xs ${monthlyWins ? 'text-emerald-700/70' : 'text-slate-500'}`}>
                    Recharge {comparison?.monthly_amount_bdt ?? '—'} BDT on the 1st of each month.
                  </p>
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Billed cost</p>
                  <div className={`mb-1 text-3xl font-bold ${monthlyWins ? 'text-emerald-700' : 'text-slate-800'}`}>
                    {formatBdt(habitResult.monthlyCost)}
                  </div>
                  <p className="text-xs text-slate-500">
                    Fixed charges {formatBdt(habitResult.monthlyFixedCharges)} · energy + VAT{' '}
                    {formatBdt(habitResult.energyAndVat)}
                  </p>
                </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
