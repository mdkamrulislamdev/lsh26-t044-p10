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
import { PLACEHOLDER_BALANCE } from '../data/placeholders'
import { formatBdt, formatShortDate } from '../lib/utils'
import { Card, CardHeader } from './ui/Card'

type TooltipPayload = {
  active?: boolean
  payload?: Array<{ payload: (typeof PLACEHOLDER_BALANCE)[number] }>
}

function ChartTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-ink">{formatShortDate(point.date)}</p>
      <p className="mt-1 text-muted">Balance {formatBdt(point.balance)}</p>
      {point.recharge ? (
        <p className="mt-1 font-medium text-brand">
          Recharge {formatBdt(point.rechargeAmount ?? 0)}
        </p>
      ) : null}
    </div>
  )
}

function RechargeDot(props: {
  cx?: number
  cy?: number
  payload?: (typeof PLACEHOLDER_BALANCE)[number]
}) {
  const { cx, cy, payload } = props
  if (cx === undefined || cy === undefined || !payload) return null
  if (!payload.recharge) {
    return <circle cx={cx} cy={cy} r={3} fill="#0B6E4F" />
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="#FFF4ED" stroke="#C2410C" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={3} fill="#C2410C" />
    </g>
  )
}

export function BalanceChart() {
  const rechargeDates = PLACEHOLDER_BALANCE.filter((point) => point.recharge)

  return (
    <Card id="balance">
      <CardHeader
        eyebrow="Step 2 · Balance charting"
        title="Daily meter balance"
        description="Placeholder series with recharge markers. Values are stubbed until the backend calculation engine is wired up."
      />

      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-6 rounded bg-brand" />
          Daily balance
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border-2 border-alert bg-alert-soft" />
          Recharge day
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-px bg-alert" />
          Recharge marker
        </span>
      </div>

      <div className="h-72 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={PLACEHOLDER_BALANCE} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#E4DFD4" strokeDasharray="3 6" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: '#5C6358', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#E4DFD4' }}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={(value: number) => `৳${value}`}
              tick={{ fill: '#5C6358', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip content={<ChartTooltip />} />
            {rechargeDates.map((point) => (
              <ReferenceLine
                key={point.date}
                x={point.date}
                stroke="#C2410C"
                strokeDasharray="4 4"
              />
            ))}
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#0B6E4F"
              strokeWidth={2.5}
              dot={<RechargeDot />}
              activeDot={{ r: 6, fill: '#094D38' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
