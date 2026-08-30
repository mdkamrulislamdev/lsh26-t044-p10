import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { compareHabits, runPredictions, runSimulation } from './billingEngine'

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

type ChartPoint = {
  date: string
  balance: number
  rechargeAmount: number | null
}

type TooltipViewProps = {
  active?: boolean
  payload?: Array<{ payload: ChartPoint }>
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
        Balance: <span className="font-mono text-amber-400">{data.balance} BDT</span>
      </p>
      {data.rechargeAmount ? (
        <p className="mt-1 font-bold text-green-400">+ Recharge: {data.rechargeAmount} BDT</p>
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
    if (!parsedData || !simulation?.finalState.date) return null
    if (parsedData.usual_daily_units === undefined || !parsedData.target_date) return null
    return runPredictions(
      {
        ...simulation.finalState,
        date: parsedData.today ?? simulation.finalState.date,
      },
      parsedData.usual_daily_units,
      parsedData.target_date,
    )
  }, [parsedData, simulation])

  const habitResult = useMemo(() => {
    if (!parsedData?.comparison) return null
    return compareHabits(parsedData.days, parsedData.comparison)
  }, [parsedData])

  const comparison = parsedData?.comparison
  const monthCount = comparison?.months.length || 3
  const monthlyWins = habitResult?.winner === 'Monthly'
  const lowWins = habitResult?.winner === 'Low Balance'

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
              placeholder="Paste JSON here..."
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
            />
            {error ? <p className="mb-3 text-xs font-medium text-red-500">{error}</p> : null}
            <button
              type="button"
              onClick={handleLoadData}
              className="w-full rounded-lg bg-slate-800 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-900"
            >
              Load Data
            </button>
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
                    Balance Depletion Warning
                  </p>
                  <p className="mb-2 text-sm text-slate-700">
                    Based on usual usage of{' '}
                    <span className="font-bold">{parsedData.usual_daily_units ?? '—'} units/day</span>
                    , runs out on:
                  </p>
                  <p className="text-2xl font-bold text-red-700">{formatLongDate(predictions?.runOutDate)}</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
                    Target Recharge
                  </p>
                  <p className="mb-2 text-sm text-slate-700">
                    To last until <span className="font-bold">{parsedData.target_date ?? '—'}</span>,
                    recharge today:
                  </p>
                  <p className="mb-3 text-2xl font-bold text-blue-700">
                    {formatBdt(predictions?.amountNeededToday ?? 0)}
                  </p>
                  <div className="space-y-1 rounded bg-white/60 p-2 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Energy:</span> <span>{formatBdt(predictions?.breakdown.energy ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Slab Penalty:</span>{' '}
                      <span>{formatBdt(predictions?.breakdown.slabPenalty ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fixed Charges:</span>{' '}
                      <span>{formatBdt(predictions?.breakdown.fixedCharges ?? 0)}</span>
                    </div>
                    <div className="mt-1 flex justify-between border-t border-blue-200 pt-1 font-semibold">
                      <span>VAT (5%):</span> <span>{formatBdt(predictions?.breakdown.vat ?? 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="col-span-1 flex flex-col gap-6 lg:col-span-2">
          <div className="flex min-h-[400px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
              Balance History
            </h2>
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
                          payload?: ChartPoint
                        }
                        if (!payload?.rechargeAmount || cx === undefined || cy === undefined) {
                          return <g key={`dot-${index ?? payload?.date ?? 'x'}`} />
                        }
                        return (
                          <circle
                            key={`recharge-${payload.date}`}
                            cx={cx}
                            cy={cy}
                            r={4}
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
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
              Habit Comparison: 3-Month Simulation
            </h2>
            {!parsedData ? (
              <div className="flex flex-1 items-center justify-center rounded-lg bg-slate-50/50 text-sm text-slate-400">
                Load data to run simulation.
              </div>
            ) : (
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
                      WINNER
                    </div>
                  ) : null}
                  <h3 className={`mb-1 font-bold ${lowWins ? 'text-emerald-900' : 'text-slate-800'}`}>
                    &quot;Low Balance&quot; Habit
                  </h3>
                  <p className={`mb-4 text-xs ${lowWins ? 'text-emerald-700/70' : 'text-slate-500'}`}>
                    Recharge {comparison?.low_amount_bdt ?? '—'} BDT when balance drops below{' '}
                    {comparison?.low_threshold_bdt ?? '—'} BDT.
                  </p>
                  <div className={`mb-1 text-3xl font-bold ${lowWins ? 'text-emerald-700' : 'text-slate-800'}`}>
                    {formatBdt(habitResult?.lowBalanceCost ?? 0)}
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      monthlyWins ? 'text-red-500' : lowWins ? 'text-emerald-600' : 'text-slate-500'
                    }`}
                  >
                    {monthlyWins
                      ? `+ Costs more over ${monthCount} months`
                      : lowWins
                        ? `Saves ${formatBdt(habitResult?.difference ?? 0)} total`
                        : `Same total over ${monthCount} months`}
                  </p>
                </div>

                <div
                  className={`relative flex-1 overflow-hidden rounded-lg border p-4 ${
                    monthlyWins || habitResult?.winner === 'Tie'
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {monthlyWins ? (
                    <div className="absolute top-0 right-0 rounded-bl-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-white">
                      WINNER
                    </div>
                  ) : null}
                  <h3
                    className={`mb-1 font-bold ${
                      monthlyWins || habitResult?.winner === 'Tie' ? 'text-emerald-900' : 'text-slate-800'
                    }`}
                  >
                    &quot;1st of Month&quot; Habit
                  </h3>
                  <p
                    className={`mb-4 text-xs ${
                      monthlyWins || habitResult?.winner === 'Tie'
                        ? 'text-emerald-700/70'
                        : 'text-slate-500'
                    }`}
                  >
                    Recharge {comparison?.monthly_amount_bdt ?? '—'} BDT on the 1st of each month.
                  </p>
                  <div
                    className={`mb-1 text-3xl font-bold ${
                      monthlyWins || habitResult?.winner === 'Tie' ? 'text-emerald-700' : 'text-slate-800'
                    }`}
                  >
                    {formatBdt(habitResult?.monthlyCost ?? 0)}
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      monthlyWins ? 'text-emerald-600' : lowWins ? 'text-red-500' : 'text-slate-500'
                    }`}
                  >
                    {monthlyWins
                      ? `Saves ${formatBdt(habitResult?.difference ?? 0)} total`
                      : lowWins
                        ? `+ Costs more over ${monthCount} months`
                        : `Same total over ${monthCount} months`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
