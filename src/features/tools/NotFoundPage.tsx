import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="max-w-[680px]">
      <h1 className="heading-3">That page is not here</h1>
      <p className="body-3 mt-3 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
        The tool or page you asked for does not exist. Every available tool is listed on the
        home page.
      </p>
      <Link
        to="/"
        className="button-md mt-6 inline-block rounded-xl bg-[var(--color-accent)] px-3 py-2 text-white outline-none transition-all duration-300 hover:bg-[var(--color-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98]"
      >
        Browse all tools
      </Link>
    </section>
  )
}
