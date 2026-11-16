import { useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Moon, Sun, Desktop } from '@phosphor-icons/react'
import { useTheme, type ThemeMode } from '../app/theme'
import Toaster from './Toaster'

function ThemeSelect() {
  const { mode, setMode } = useTheme()
  const Icon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Desktop
  return (
    <label className="flex items-center gap-2">
      <Icon size={20} aria-hidden />
      <span className="sr-only">Theme</span>
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as ThemeMode)}
        className="button-sm rounded-lg bg-transparent px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] dark:text-[var(--color-dark-ink)]"
        aria-label="Theme"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  )
}

export default function Layout() {
  const apply = useTheme((s) => s.apply)

  useEffect(() => {
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [apply])

  const clearLocalData = () => {
    localStorage.clear()
    window.location.reload()
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 sm:px-6">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-lg focus:bg-[var(--color-accent)] focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-3 z-10 mt-3 flex items-center justify-between rounded-2xl bg-white/80 px-4 py-2 shadow-sm backdrop-blur-md transition-colors duration-300 dark:bg-[var(--color-dark-raised)]/85">
        <Link to="/" className="title-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">
          FileTweaks
        </Link>
        <nav aria-label="Main" className="flex items-center gap-4">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `button-sm rounded-lg px-2 py-2 outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${isActive ? 'text-[var(--color-accent)] dark:text-white' : ''}`
            }
          >
            Tools
          </NavLink>
          <NavLink
            to="/privacy"
            className={({ isActive }) =>
              `button-sm rounded-lg px-2 py-2 outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${isActive ? 'text-[var(--color-accent)] dark:text-white' : ''}`
            }
          >
            Privacy
          </NavLink>
          <ThemeSelect />
        </nav>
      </header>

      <main id="main" className="flex-1 py-12">
        <Outlet />
      </main>

      <Toaster />
      <footer className="flex flex-col gap-3 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="caption-2 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
          FileTweaks runs entirely in your browser. Your files never leave your device.
        </p>
        <div className="flex items-center gap-4">
          <Link to="/privacy" className="button-sm rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">
            Privacy
          </Link>
          <button
            type="button"
            onClick={clearLocalData}
            className="button-sm rounded-lg outline-none transition-transform duration-300 hover:text-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98]"
          >
            Clear local data
          </button>
        </div>
      </footer>
    </div>
  )
}
