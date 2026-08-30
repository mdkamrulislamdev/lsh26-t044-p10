import { useState, type ReactNode } from 'react'
import { CheckCircle2, ClipboardPaste, Eraser, FolderOpen } from 'lucide-react'
import { SAMPLE_JSON } from '../data/sample'
import { parseHouseholdJson, parseHouseholdValue } from '../lib/parseHousehold'
import { formatBdt, formatDate } from '../lib/utils'
import type { HouseholdData } from '../types'
import { Button } from './ui/Button'
import { Card, CardHeader } from './ui/Card'

type DataIngestionProps = {
  cases: HouseholdData[]
  selectedCase: HouseholdData | null
  onLoad: (cases: HouseholdData[]) => void
  onSelectCase: (caseId: string) => void
}

export function DataIngestion({
  cases,
  selectedCase,
  onLoad,
  onSelectCase,
}: DataIngestionProps) {
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loadingPublic, setLoadingPublic] = useState(false)

  function applyParsed(result: { cases?: HouseholdData[]; error?: string }) {
    if (result.error || !result.cases?.length) {
      setError(result.error ?? 'Could not load this JSON.')
      return
    }
    setError(null)
    onLoad(result.cases)
  }

  function handleLoad() {
    applyParsed(parseHouseholdJson(raw))
  }

  async function handleLoadPublic() {
    setLoadingPublic(true)
    setError(null)
    try {
      const response = await fetch('/P10_prepaid_meter_public.json')
      if (!response.ok) {
        throw new Error('Public dataset is not available yet.')
      }
      const json: unknown = await response.json()
      applyParsed(parseHouseholdValue(json))
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load the public prepaid meter dataset.',
      )
    } finally {
      setLoadingPublic(false)
    }
  }

  return (
    <Card id="ingest">
      <CardHeader
        eyebrow="Step 1 · Data ingestion"
        title="Paste household JSON"
        description="Load a single case or a { cases: [...] } file. Charts and forecasts stay on placeholder values until the calculation engine is connected."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setRaw(SAMPLE_JSON)}>
              <ClipboardPaste size={16} />
              Insert sample
            </Button>
            <Button variant="ghost" onClick={() => setRaw('')}>
              <Eraser size={16} />
              Clear
            </Button>
          </div>
        }
      />

      <label htmlFor="household-json" className="sr-only">
        Household JSON
      </label>
      <textarea
        id="household-json"
        value={raw}
        onChange={(event) => {
          setRaw(event.target.value)
          if (error) setError(null)
        }}
        spellCheck={false}
        placeholder='{"opening_balance_bdt": "350.00", "days": [...], "recharges": [...], "comparison": {...}}'
        className="min-h-52 w-full resize-y rounded-xl border border-line bg-canvas px-4 py-3 font-mono text-xs leading-6 text-ink outline-none transition-shadow placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20 sm:min-h-64 sm:text-sm"
      />

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-xs leading-5 text-muted">
          Expected keys: opening_balance_bdt, days, recharges, today, usual_daily_units, target_date,
          comparison.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleLoadPublic} disabled={loadingPublic}>
            <FolderOpen size={16} />
            {loadingPublic ? 'Loading…' : 'Load public cases'}
          </Button>
          <Button onClick={handleLoad} className="sm:min-w-36">
            Load Data
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-alert/20 bg-alert-soft px-4 py-3 text-sm text-alert">
          {error}
        </p>
      ) : null}

      {selectedCase ? (
        <div className="mt-5 space-y-3 rounded-xl border border-brand/15 bg-brand-soft p-4">
          {cases.length > 1 ? (
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Loaded cases
              </span>
              <select
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:max-w-xs"
                value={selectedCase.case_id ?? ''}
                onChange={(event) => onSelectCase(event.target.value)}
              >
                {cases.map((item) => (
                  <option key={item.case_id} value={item.case_id}>
                    {item.case_id} · {item.days.length} days
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatusItem
              icon={<CheckCircle2 size={16} />}
              label="Opening balance"
              value={formatBdt(selectedCase.opening_balance_bdt)}
            />
            <StatusItem label="Usage days" value={`${selectedCase.days.length} days`} />
            <StatusItem label="Recharges" value={`${selectedCase.recharges.length} recorded`} />
            <StatusItem label="Today" value={formatDate(selectedCase.today)} />
          </div>
        </div>
      ) : null}
    </Card>
  )
}

function StatusItem({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: ReactNode
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-brand-dark">{value}</p>
    </div>
  )
}
