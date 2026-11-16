import { useState } from 'react'
import ToolWorkspace, { fieldClass, labelClass, panelClass } from '../../shared/ToolWorkspace'
import { getTool } from '../registry'
import type { NUpCount, Orientation, SheetName } from './process'
const tool = getTool('n-up')!

const GAPS = { tight: 0, standard: 12, wide: 24 } as const
type GapChoice = keyof typeof GAPS

export default function NUpTool() {
  const [perSheet, setPerSheet] = useState<NUpCount>(4)
  const [sheet, setSheet] = useState<SheetName>('a4')
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const [gap, setGap] = useState<GapChoice>('standard')

  return (
    <ToolWorkspace
      tool={tool}
      actionLabel={() => `Place ${perSheet} pages per sheet`}
      canRun={(files) => files.length === 1 && !files[0].error && !!files[0].buffer}
      onProcess={async (files) => {
        const { nUpPdf } = await import('./process')
        const result = await nUpPdf(files[0].buffer!, { perSheet, sheet, orientation, gapPt: GAPS[gap] })
        return [{
          name: 'n-up.pdf',
          blob: new Blob([result.data as BlobPart], { type: 'application/pdf' }),
          summary: `${result.pageCount} pages placed ${perSheet} to a sheet on ${result.sheetCount} ${result.sheetCount === 1 ? 'sheet' : 'sheets'}, ready to print`,
        }]
      }}
    >
      {() => (
        <div className={panelClass}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}><span className="button-sm">Pages per sheet</span>
              <select value={perSheet} onChange={(e) => setPerSheet(Number(e.target.value) as NUpCount)} className={fieldClass}>
                <option value={2}>2 pages per sheet</option>
                <option value={4}>4 pages per sheet</option>
                <option value={6}>6 pages per sheet</option>
                <option value={9}>9 pages per sheet</option>
              </select></label>
            <label className={labelClass}><span className="button-sm">Sheet size</span>
              <select value={sheet} onChange={(e) => setSheet(e.target.value as SheetName)} className={fieldClass}>
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
              </select></label>
            <label className={labelClass}><span className="button-sm">Orientation</span>
              <select value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)} className={fieldClass}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select></label>
            <label className={labelClass}><span className="button-sm">Gap between pages</span>
              <select value={gap} onChange={(e) => setGap(e.target.value as GapChoice)} className={fieldClass}>
                <option value="tight">Tight, no gap</option>
                <option value="standard">Standard</option>
                <option value="wide">Wide</option>
              </select></label>
          </div>
          <p className="body-6 text-[var(--color-ink-muted)] dark:text-[var(--color-dark-muted)]">Pages keep their order and shape, scaled to fit their space on the sheet with a half-inch margin at the edges. The last sheet may have empty spaces. This tool does not reorder pages for booklet folding — pages run in reading order, first to last.</p>
        </div>
      )}
    </ToolWorkspace>
  )
}
