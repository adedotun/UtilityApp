import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MagnifyingGlass, ShieldCheck } from '@phosphor-icons/react'
import { CATEGORY_LABELS, TOOLS, getTool, toolsByCategory, type ToolCategory, type ToolDef } from '../tools/registry'
import { Star } from '@phosphor-icons/react'
import { usePrefs } from '../../app/prefs'

const CATEGORIES: ToolCategory[] = ['convert', 'organise', 'edit-sign', 'optimise', 'security']

export default function HomePage() {
  const [query, setQuery] = useState('')
  const { favourites, recent, toggleFavourite } = usePrefs()
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return TOOLS.filter(
      (t) => t.name.toLowerCase().includes(q) || t.outcome.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <>
      <section className="max-w-[680px]">
        <h1 className="heading-1">
          PDF tools that never upload your files
        </h1>
        <p className="body-3 mt-4 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
          Merge, split, convert, sign, edit and compress PDFs and Word documents, entirely in
          your browser. No sign up, and nothing to install.
        </p>
        <p className="caption-2 mt-4 flex items-center gap-2 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
          <ShieldCheck size={20} aria-hidden />
          Files are processed on your device and discarded when you close the tab.
        </p>

        <label className="mt-8 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm transition-colors duration-300 focus-within:ring-2 focus-within:ring-[var(--color-accent)] dark:bg-[var(--color-dark-raised)]">
          <MagnifyingGlass size={20} aria-hidden />
          <span className="sr-only">Search tools</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, for example merge or sign"
            className="body-3 w-full bg-transparent outline-none placeholder:text-[var(--color-ink-muted)] dark:placeholder:text-[var(--color-dark-muted)]"
          />
          <kbd className="caption-2 hidden rounded-lg bg-[var(--color-surface-raised)] px-2 py-1 sm:block dark:bg-[var(--color-dark-panel)]">
            Search
          </kbd>
        </label>
      </section>

      {!filtered && (favourites.length > 0 || recent.length > 0) ? (
        <section className="mt-12" aria-label="Your tools">
          <h2 className="heading-5">Your tools</h2>
          <ToolGrid tools={[...new Set([...favourites, ...recent])].map((s) => getTool(s)).filter((x): x is ToolDef => !!x)} favourites={favourites} onToggleFavourite={toggleFavourite} />
        </section>
      ) : null}

      {filtered ? (
        <section className="mt-12" aria-label="Search results">
          <h2 className="heading-5">
            {filtered.length} {filtered.length === 1 ? 'tool' : 'tools'} found
          </h2>
          {filtered.length === 0 ? (
            <p className="body-3 mt-4 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
              No tool matches that search yet. Try merge, split, sign or compress.
            </p>
          ) : (
            <ToolGrid tools={filtered} favourites={favourites} onToggleFavourite={toggleFavourite} />
          )}
        </section>
      ) : (
        CATEGORIES.map((category) => (
          <section key={category} className="mt-12" aria-label={CATEGORY_LABELS[category]}>
            <h2 className="heading-5">{CATEGORY_LABELS[category]}</h2>
            <ToolGrid tools={toolsByCategory(category)} favourites={favourites} onToggleFavourite={toggleFavourite} />
          </section>
        ))
      )}

      <section className="mt-16 max-w-[680px]" aria-label="Frequently asked questions">
        <h2 className="heading-5">Questions people ask</h2>
        <dl className="mt-6 flex flex-col gap-6">
          {[
            ['Are my files uploaded anywhere?', 'No. Every tool runs in your browser on your device. There is no server in the design that could receive your files, and closing the tab discards everything held in memory.'],
            ['Do I need an account or to pay?', 'No. PDF Tweaks is free, with no sign up and no daily limits.'],
            ['Does it work offline?', 'After the first visit, the app is cached on your device and the tools work without a connection. Large engines such as the PDF renderer are cached the first time you open a tool that needs them.'],
            ['Why does Word to PDF look simpler than my document?', 'The conversion keeps your text and paragraph structure. Complex Word layout, tables, headers and styling do not carry across exactly, and the tool says so before you convert.'],
            ['Is redact safe for sensitive information?', 'Redact draws a solid box over the page. It does not remove the underlying text layer, so do not rely on it alone for truly sensitive information in a file you share widely. The Edit PDF tool states this plainly too.'],
            ['What is stored on my device?', 'Only your theme choice, favourite and recent tools, and signatures you choose to save. File contents and processed file names are never stored. Clear local data in the footer removes all of it.'],
          ].map(([q, a]) => (
            <div key={q}>
              <dt className="title-3">{q}</dt>
              <dd className="body-6 mt-1 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  )
}


function ToolGrid({ tools, favourites = [], onToggleFavourite }: { tools: typeof TOOLS; favourites?: string[]; onToggleFavourite?: (slug: string) => void }) {
  return (
    <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => {
        const Icon = tool.icon
        return (
          <li key={tool.slug}>
            <Link
              to={`/tools/${tool.slug}`}
              className="flex h-full flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm outline-none transition-all duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] dark:bg-[var(--color-dark-raised)]"
            >
              <Icon size={28} aria-hidden />
              <span className="title-3">{tool.name}</span>
              <span className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
                {tool.outcome}
              </span>
              <span className="caption-2 mt-auto flex items-center justify-between text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
                <span>{tool.accept.join(', ')}</span>
                {onToggleFavourite ? (
                  <button type="button" aria-label={favourites.includes(tool.slug) ? `Remove ${tool.name} from favourites` : `Add ${tool.name} to favourites`} aria-pressed={favourites.includes(tool.slug)}
                    onClick={(e) => { e.preventDefault(); onToggleFavourite(tool.slug) }}
                    className="rounded-lg p-1 outline-none transition-all duration-300 hover:text-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98]">
                    <Star size={16} weight={favourites.includes(tool.slug) ? 'fill' : 'regular'} aria-hidden />
                  </button>
                ) : null}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}