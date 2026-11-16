export default function PrivacyPage() {
  return (
    <section className="max-w-[680px]">
      <h1 className="heading-3">Privacy</h1>
      <div className="body-3 mt-4 flex flex-col gap-4 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
        <p>
          FileTweaks processes every file in your browser, on your device. Files are never
          uploaded to a server, because there is no server in the design that could receive
          them.
        </p>
        <p>
          The only information stored on your device is your theme choice, your favourite and
          recent tools, and any signatures you choose to save for reuse. File contents and the
          names of documents you process are never stored. Closing the tab discards everything
          held in memory.
        </p>
        <p>
          There is no analytics, no tracking, and no third party script loaded at runtime. All
          libraries are bundled with the app itself. Use Clear local data in the footer to wipe
          what is stored on this device.
        </p>
      </div>
    </section>
  )
}
