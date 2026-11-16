import { useEffect, useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
import type { FormFieldInfo, FormInfo, FormValues } from './process'
const tool = getTool('fill-form')!

interface LoadedInfo extends FormInfo { buffer: ArrayBuffer }

function initialValues(fields: FormFieldInfo[]): FormValues {
  const values: FormValues = {}
  for (const f of fields) {
    if (!f.editable) continue
    if (f.type === 'checkbox') values[f.name] = f.value === true
    else if (f.type === 'dropdown' || f.type === 'option-list') values[f.name] = Array.isArray(f.value) ? (f.value[0] ?? '') : ''
    else values[f.name] = typeof f.value === 'string' ? f.value : ''
  }
  return values
}

/** Loads the form fields of the current file and reports them to the parent. */
function FieldLoader({ buffer, onInfo, onError }: { buffer: ArrayBuffer; onInfo: (info: FormInfo) => void; onError: (message: string) => void }) {
  useEffect(() => {
    let alive = true
    import('./process')
      .then((m) => m.listFormFields(buffer))
      .then((info) => { if (alive) onInfo(info) })
      .catch((err: unknown) => { if (alive) onError(err instanceof Error ? err.message : 'The form fields could not be read.') })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer])
  return <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]" aria-busy="true">Reading the form fields…</p>
}

export default function FillFormTool() {
  const [loaded, setLoaded] = useState<LoadedInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [values, setValues] = useState<FormValues>({})
  const [initials, setInitials] = useState<FormValues>({})
  const [flatten, setFlatten] = useState(false)

  const handleInfo = (buffer: ArrayBuffer) => (info: FormInfo) => {
    setLoaded({ ...info, buffer })
    setLoadError(null)
    const init = initialValues(info.fields)
    setValues(init)
    setInitials(init)
  }

  const changedCount = loaded
    ? loaded.fields.filter((f) => f.editable && values[f.name] !== initials[f.name]).length
    : 0

  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => (flatten ? 'Fill and flatten' : 'Fill form')}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer && !!loaded && loaded.buffer === files[0].buffer && changedCount > 0}
      onProcess={async (files) => {
        const { fillForm } = await import('./process')
        const result = await fillForm(files[0].buffer!, values, { flatten })
        return [{
          name: 'filled-form.pdf',
          blob: new Blob([result.data as BlobPart], { type: 'application/pdf' }),
          summary: flatten
            ? `${result.filledCount} ${result.filledCount === 1 ? 'field' : 'fields'} filled and then flattened into the pages, so the answers can no longer be edited`
            : `${result.filledCount} ${result.filledCount === 1 ? 'field' : 'fields'} filled. The form stays fillable, so the answers can still be changed later`,
        }]
      }}
    >
      {({ files }) => {
        const buffer = files[0]?.buffer
        if (!buffer) {
          return <div className={panelClass}><p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Add a PDF in Step 1 and its form fields will appear here, one input per field.</p></div>
        }
        if (loadError) {
          return <div className={panelClass}><p role="alert" className="body-6 text-[var(--color-danger)]">{loadError}</p></div>
        }
        if (!loaded || loaded.buffer !== buffer) {
          return (
            <div className={panelClass}>
              <FieldLoader buffer={buffer} onInfo={handleInfo(buffer)} onError={setLoadError} />
            </div>
          )
        }
        const editable = loaded.fields.filter((f) => f.editable)
        const unfillable = loaded.fields.filter((f) => !f.editable)
        if (editable.length === 0) {
          return (
            <div className={panelClass}>
              {loaded.hasXfa ? (
                <p className="body-6">This PDF's form is built with XFA technology, which is common in older government forms. XFA fields cannot be read or filled in a browser — this is a limit of the format, not of your file. A desktop PDF reader, such as Adobe Acrobat, can fill this form.</p>
              ) : (
                <p className="body-6">This PDF has no form fields to fill. It may be a plain document, or a form that was printed to PDF, which turns the fields into ordinary page content. There is nothing to fill here.</p>
              )}
            </div>
          )
        }
        return (
          <div className={panelClass}>
            {loaded.hasXfa ? (
              <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">This form also carries XFA data. The standard fields below can be filled here; anything that only exists in the XFA part cannot.</p>
            ) : null}
            {editable.map((f) => (
              <div key={f.name}>
                {f.type === 'checkbox' ? (
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={values[f.name] === true}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked }))}
                      className="accent-[var(--color-accent)]"
                    />
                    <span className="button-sm">{f.name}</span>
                  </label>
                ) : f.type === 'dropdown' || f.type === 'radio' || f.type === 'option-list' ? (
                  <label className={labelClass}><span className="button-sm">{f.name}</span>
                    <select
                      value={typeof values[f.name] === 'string' ? (values[f.name] as string) : ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      className={fieldClass}
                    >
                      <option value="">Choose…</option>
                      {(f.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                    </select></label>
                ) : f.multiline ? (
                  <label className={labelClass}><span className="button-sm">{f.name}</span>
                    <textarea
                      rows={3}
                      value={typeof values[f.name] === 'string' ? (values[f.name] as string) : ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      className={fieldClass}
                    /></label>
                ) : (
                  <label className={labelClass}><span className="button-sm">{f.name}</span>
                    <input
                      type="text"
                      value={typeof values[f.name] === 'string' ? (values[f.name] as string) : ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      className={fieldClass}
                    /></label>
                )}
              </div>
            ))}
            {unfillable.length > 0 ? (
              <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
                This form also has {unfillable.length} {unfillable.length === 1 ? 'field' : 'fields'} that cannot be filled in a browser ({unfillable.map((f) => `${f.name} (${f.type === 'signature' ? 'signature' : f.type})`).join(', ')}). They are left exactly as they are. For a signature, the Sign PDF tool can place one on the page.
              </p>
            ) : null}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--color-surface-raised)] p-4 dark:bg-[var(--color-dark-panel)]">
              <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} className="mt-1 accent-[var(--color-accent)]" />
              <span><span className="title-3 block">Flatten after filling</span><span className="body-6 block text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Bake the answers into the pages so they can no longer be edited. Best for a final copy you are sending on; leave it off if the form may need changes.</span></span>
            </label>
            <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">
              {changedCount === 0 ? 'Nothing has been changed yet. Fill in at least one field to continue.' : `${changedCount} ${changedCount === 1 ? 'field' : 'fields'} changed, ready to save.`}
            </p>
          </div>
        )
      }}
    </ToolWorkspace>
  )
}
