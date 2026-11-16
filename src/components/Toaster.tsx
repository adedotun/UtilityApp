import { CheckCircle, WarningCircle, Info, X } from '@phosphor-icons/react'
import { useToasts } from '../lib/toast'

const ICONS = { success: CheckCircle, error: WarningCircle, info: Info }

export default function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-xl bg-white p-4 shadow-lg transition-all duration-300 dark:bg-[var(--color-dark-panel)]">
            <Icon size={20} aria-hidden className={t.kind === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-accent)]'} />
            <p className="body-6 flex-1">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss message" className="rounded-lg outline-none transition-transform duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98]">
              <X size={16} aria-hidden />
            </button>
          </div>
        )
      })}
    </div>
  )
}
