import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
const tool = getTool('password-protect')!

export default function PasswordProtectTool() {
  const [userPw, setUserPw] = useState('')
  const [ownerPw, setOwnerPw] = useState('')
  return (
    <ToolWorkspace
      tool={tool}
      notice="Protection uses real 256-bit AES encryption (qpdf, running locally in your browser). Pick a password you will remember: there is no recovery if you lose it."
      actionLabel={() => 'Protect PDF'}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer && userPw.length >= 4}
      onProcess={async (files) => {
        const { encryptPdf } = await import('./process')
        const data = await encryptPdf(files[0].buffer!, userPw, ownerPw)
        return [{ name: 'protected.pdf', blob: new Blob([data as BlobPart], { type: 'application/pdf' }), summary: 'Protected with 256-bit AES encryption' }]
      }}
    >
      {() => (
        <div className={panelClass}>
          <label className={labelClass}><span className="button-sm">Password to open the file</span>
            <input type="password" value={userPw} onChange={(e) => setUserPw(e.target.value)} className={fieldClass} autoComplete="new-password" /></label>
          <label className={labelClass}><span className="button-sm">Owner password, optional</span>
            <input type="password" value={ownerPw} onChange={(e) => setOwnerPw(e.target.value)} className={fieldClass} autoComplete="new-password" /></label>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Use at least 4 characters for the opening password. Passwords are used only on this device and are never stored. If the owner password is left blank, the opening password is used for both.</p>
        </div>
      )}
    </ToolWorkspace>
  )
}
