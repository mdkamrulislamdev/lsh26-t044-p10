import { Banknote, CalendarClock } from 'lucide-react'
import { PLACEHOLDER_PREDICTION } from '../data/placeholders'
import { formatBdt } from '../lib/utils'

export function PredictionCards() {
  const { runsOutLabel, daysRemaining, amountNeededToday, targetDate } = PLACEHOLDER_PREDICTION

  return (
    <section id="forecast" className="grid gap-4 md:grid-cols-2">
      <article className="rounded-2xl border-2 border-alert bg-alert-soft p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-alert">
            Critical alert
          </p>
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-alert">
            {daysRemaining} days left
          </span>
        </div>
        <div className="mt-5 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-alert text-white">
            <CalendarClock size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-medium text-alert">Date Balance Runs Out</h2>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {runsOutLabel}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Placeholder forecast. At the current usage pattern the meter is expected to hit zero
              before the {targetDate} target.
            </p>
          </div>
        </div>
      </article>

      <article className="rounded-2xl border-2 border-warn bg-warn-soft p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-warn">
            Recharge now
          </p>
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-warn">
            Needed today
          </span>
        </div>
        <div className="mt-5 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warn text-white">
            <Banknote size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-medium text-warn">Amount Needed Today (BDT)</h2>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {formatBdt(amountNeededToday)}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Placeholder amount to cover usage through the target date. The calculation engine will
              replace this stub later.
            </p>
          </div>
        </div>
      </article>
    </section>
  )
}
