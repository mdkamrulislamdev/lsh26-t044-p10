import { Menu, X, Zap } from 'lucide-react'
import { Button } from './ui/Button'

type NavbarProps = {
  menuOpen: boolean
  onToggleMenu: () => void
  dataLoaded: boolean
}

export function Navbar({ menuOpen, onToggleMenu, dataLoaded }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
            <Zap size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-none text-ink">MeterWise</p>
            <p className="mt-1 text-xs text-muted">Prepaid Meter Recharge Advisor</p>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <span className="rounded-full border border-line bg-canvas px-3 py-1 text-xs font-medium text-muted">
            Dhaka households
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              dataLoaded ? 'bg-brand-soft text-brand-dark' : 'bg-warn-soft text-warn'
            }`}
          >
            {dataLoaded ? 'Data loaded' : 'Waiting for JSON'}
          </span>
        </div>

        <Button
          variant="secondary"
          className="px-3 md:hidden"
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          onClick={onToggleMenu}
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
          <span className="sr-only">Toggle navigation</span>
        </Button>
      </div>
    </header>
  )
}
