import { ArrowDownRight, Repeat, Wallet } from 'lucide-react'
import { PLACEHOLDER_COMPARISON } from '../data/placeholders'
import { formatBdt } from '../lib/utils'
import type { HouseholdData } from '../types'
import { Card, CardHeader } from './ui/Card'

type ComparisonViewProps = {
  data: HouseholdData | null
}

export function ComparisonView({ data }: ComparisonViewProps) {
  const comparison = data?.comparison
  const stub = PLACEHOLDER_COMPARISON
  const months = comparison?.months?.length ? comparison.months.join(' · ') : 'Apr–Jun placeholder'

  const cards = [
    {
      key: 'low',
      icon: Repeat,
      label: stub.lowBalance.label,
      total: stub.lowBalance.totalCost,
      notes: stub.lowBalance.notes,
      stats: [
        { label: 'Threshold', value: formatBdt(comparison?.low_threshold_bdt ?? '100.00') },
        { label: 'Top-up amount', value: formatBdt(comparison?.low_amount_bdt ?? '2000.00') },
        { label: 'Trigger', value: 'When balance is low' },
      ],
      tone: 'alert' as const,
    },
    {
      key: 'monthly',
      icon: Wallet,
      label: stub.monthly.label,
      total: stub.monthly.totalCost,
      notes: stub.monthly.notes,
      stats: [
        { label: 'Monthly amount', value: formatBdt(comparison?.monthly_amount_bdt ?? '2000.00') },
        { label: 'Cadence', value: 'Once per month' },
        { label: 'Source', value: comparison?.source ?? 'readings' },
      ],
      tone: 'brand' as const,
    },
  ]

  return (
    <Card id="habits">
      <CardHeader
        eyebrow="Step 3 · Comparison"
        title="Low Balance Habit vs Monthly Habit"
        description={`Side-by-side cost of topping up only at a low threshold versus one planned monthly recharge. Comparison window: ${months}.`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon
          const isLow = card.tone === 'alert'
          return (
            <article
              key={card.key}
              className={`rounded-2xl border p-5 ${
                isLow ? 'border-alert/20 bg-alert-soft/60' : 'border-brand/20 bg-brand-soft'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${
                    isLow ? 'bg-alert' : 'bg-brand'
                  }`}
                >
                  <Icon size={18} aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold text-ink">{card.label}</h3>
              </div>

              <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">Total cost</p>
              <p className="text-3xl font-semibold tracking-tight text-ink">{formatBdt(card.total)}</p>
              <p className="mt-1 text-xs text-muted">Placeholder total until the engine is wired up.</p>

              <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {card.stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">{stat.label}</dt>
                    <dd className="mt-1 text-sm font-semibold text-ink">{stat.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm leading-6 text-muted">{card.notes}</p>
            </article>
          )
        })}
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-brand/20 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand">
            <ArrowDownRight size={16} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Monthly habit saves more</p>
            <p className="text-sm text-muted">
              Difference is a placeholder. Live totals will use the comparison parameters from JSON.
            </p>
          </div>
        </div>
        <p className="text-2xl font-semibold tracking-tight text-brand-dark">
          {formatBdt(stub.difference)}
        </p>
      </div>
    </Card>
  )
}
