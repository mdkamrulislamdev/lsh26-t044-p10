import { useMemo, useState } from 'react'
import { BalanceChart } from './components/BalanceChart'
import { ComparisonView } from './components/ComparisonView'
import { DataIngestion } from './components/DataIngestion'
import { Navbar } from './components/Navbar'
import { PredictionCards } from './components/PredictionCards'
import { Sidebar } from './components/Sidebar'
import type { HouseholdData, NavSection } from './types'

export default function App() {
  const [cases, setCases] = useState<HouseholdData[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [active, setActive] = useState<NavSection>('ingest')
  const [menuOpen, setMenuOpen] = useState(false)

  const selectedCase = useMemo(
    () => cases.find((item) => item.case_id === selectedId) ?? cases[0] ?? null,
    [cases, selectedId],
  )

  function handleLoad(nextCases: HouseholdData[]) {
    setCases(nextCases)
    setSelectedId(nextCases[0]?.case_id ?? null)
  }

  function handleNavigate(id: NavSection) {
    setActive(id)
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        dataLoaded={Boolean(selectedCase)}
      />

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Sidebar active={active} open={menuOpen} onNavigate={handleNavigate} />

        <main className="flex min-w-0 flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
              Dhaka · Prepaid electricity
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              See the meter, plan the recharge
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
              Paste household usage history to review balance, recharge markers, and a side-by-side
              habit comparison. Forecast cards currently show placeholder values.
            </p>
          </div>

          <DataIngestion
            cases={cases}
            selectedCase={selectedCase}
            onLoad={handleLoad}
            onSelectCase={setSelectedId}
          />
          <BalanceChart />
          <PredictionCards />
          <ComparisonView data={selectedCase} />

          <footer className="pb-8 pt-2 text-center text-xs text-muted">
            UI shell only · calculation engine not connected
          </footer>
        </main>
      </div>
    </div>
  )
}
