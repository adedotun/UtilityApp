import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
const tool = getTool('remove-password')!

export default function RemovePasswordTool() {
  const [pw, setPw] = useState('')
  return (
    <ToolWorkspace
      tool={tool}
      notice="You need the current password. Removal runs locally with qpdf in your browser; the password is never stored or sent anywhere."
      actionLabel={() => 'Remove password'}
      canRun={(files) => files.length === 1 && !!files[0].buffer && pw.length > 0}
      onProcess={async (files) => {
        const { decryptPdf } = await import('./process')
        const data = await decryptPdf(files[0].buffer!, pw)
        return [{ name: 'unlocked.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: 'Password removed. The file now opens without a password.' }]
      }}
    >
      {() => (
        <div className={panelClass}>
          <label className={labelClass}><span className="button-sm">Current password</span>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={fieldClass} autoComplete="current-password" /></label>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">If the password is wrong, nothing is changed and you will be told here.</p>
        </div>
      )}
    </ToolWorkspace>
  )
}
