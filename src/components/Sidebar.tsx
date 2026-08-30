import { BarChart3, ClipboardPaste, GitCompare, TriangleAlert } from 'lucide-react'
import type { NavSection } from '../types'
import { cn } from '../lib/utils'

const LINKS: { id: NavSection; label: string; hint: string; icon: typeof ClipboardPaste }[] = [
  { id: 'ingest', label: 'Load data', hint: 'Paste household JSON', icon: ClipboardPaste },
  { id: 'balance', label: 'Balance', hint: 'Daily meter trend', icon: BarChart3 },
  { id: 'forecast', label: 'Forecast', hint: 'When it runs out', icon: TriangleAlert },
  { id: 'habits', label: 'Habits', hint: 'Low vs monthly', icon: GitCompare },
]

type SidebarProps = {
  active: NavSection
  open: boolean
  onNavigate: (id: NavSection) => void
}

export function Sidebar({ active, open, onNavigate }: SidebarProps) {
  return (
    <aside
      id="app-sidebar"
      className={cn(
        'border-line bg-surface md:block md:rounded-2xl md:border',
        open ? 'block' : 'hidden',
      )}
    >
      <nav className="flex flex-col gap-1 p-3 md:p-4" aria-label="App sections">
        {LINKS.map((link) => {
          const Icon = link.icon
          const isActive = active === link.id
          return (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={() => onNavigate(link.id)}
              className={cn(
                'flex items-start gap-3 rounded-xl px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                isActive ? 'bg-brand-soft text-brand-dark' : 'text-ink hover:bg-canvas',
              )}
            >
              <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold">{link.label}</span>
                <span className="block text-xs text-muted">{link.hint}</span>
              </span>
            </a>
          )
        })}
      </nav>
    </aside>
  )
}
