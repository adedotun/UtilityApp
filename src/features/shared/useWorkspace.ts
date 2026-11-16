import { useCallback, useEffect, useRef, useState } from 'react'
import { countPages } from '../../lib/pdf'
import { uid, validateFile } from '../../lib/files'
import { toast } from '../../lib/toast'
import { runBatch as runBatchEngine, type BatchSuccess } from './batch'

export interface WorkspaceFile {
  id: string
  file: File
  buffer?: ArrayBuffer
  pageCount?: number
  note?: string
  error?: string
}

export interface ProcessOutput { name: string; blob: Blob; summary: string }
export type JobStatus = 'idle' | 'working' | 'done' | 'error'

/** One row of batch state: every input file, settled or not, in add order. */
export interface BatchItemState {
  sourceName: string
  status: 'waiting' | 'working' | 'done' | 'error'
  output?: BatchSuccess
  error?: string
}

export function useWorkspace(accept: string[], multiple: boolean) {
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [status, setStatus] = useState<JobStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [outputs, setOutputs] = useState<ProcessOutput[]>([])
  const [jobError, setJobError] = useState<string | null>(null)
  const [batchItems, setBatchItems] = useState<BatchItemState[] | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const addFiles = useCallback(async (incoming: File[]) => {
    const list = multiple ? incoming : incoming.slice(0, 1)
    const items: WorkspaceFile[] = []
    for (const file of list) {
      const problem = validateFile(file, accept)
      if (problem) { toast.error(problem); continue }
      const item: WorkspaceFile = { id: uid(), file }
      try {
        item.buffer = await file.arrayBuffer()
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          item.pageCount = await countPages(item.buffer)
          if (item.pageCount === 0) item.error = `${file.name} could not be read as a PDF. It may be damaged or password protected.`
        }
      } catch {
        item.error = `${file.name} could not be read.`
      }
      items.push(item)
    }
    setFiles((prev) => (multiple ? [...prev, ...items] : items))
    setOutputs([])
    setBatchItems(null)
    setStatus('idle')
    setJobError(null)
  }, [accept, multiple])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const pasted = Array.from(e.clipboardData?.files ?? [])
      if (pasted.length) void addFiles(pasted)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addFiles])

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    setBatchItems(null)
  }, [])

  const moveFile = useCallback((id: string, dir: -1 | 1) => {
    setFiles((prev) => {
      const idx = prev.findIndex((f) => f.id === id)
      const next = idx + dir
      if (idx < 0 || next < 0 || next >= prev.length) return prev
      const copy = [...prev]
      const [item] = copy.splice(idx, 1)
      copy.splice(next, 0, item)
      return copy
    })
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setFiles([]); setOutputs([]); setBatchItems(null); setStatus('idle'); setProgress(0); setJobError(null)
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setStatus('idle'); setProgress(0); setBatchItems(null)
    toast.info('Processing cancelled. Your files were not changed.')
  }, [])

  const run = useCallback(async (
    fn: (files: WorkspaceFile[], signal: AbortSignal, onProgress: (n: number) => void) => Promise<ProcessOutput[]>,
  ) => {
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('working'); setProgress(0); setJobError(null); setOutputs([])
    try {
      const result = await fn(files, controller.signal, setProgress)
      if (controller.signal.aborted) return
      setOutputs(result); setStatus('done'); setProgress(1)
      toast.success(result.length === 1 ? 'Done. Your file is ready to download.' : `Done. ${result.length} files are ready to download.`)
    } catch (err) {
      if (controller.signal.aborted) return
      const message = err instanceof Error ? err.message : 'Something went wrong while processing. Please try again.'
      setJobError(message); setStatus('error')
      toast.error(message)
    }
  }, [files])

  /**
   * Batch run: the same single-file process applied to every added file.
   * Per-file state is kept in batchItems so the UI can show each file's
   * progress and, at the end, each result or the reason it failed. A file
   * that fails never stops the others.
   */
  const runBatch = useCallback(async (
    fn: (file: WorkspaceFile, signal: AbortSignal, onProgress: (n: number) => void) => Promise<ProcessOutput>,
  ) => {
    const controller = new AbortController()
    abortRef.current = controller
    const total = files.length
    setStatus('working'); setProgress(0); setJobError(null); setOutputs([])
    setBatchItems(files.map((f) => ({ sourceName: f.file.name, status: 'waiting' as const })))
    let current = -1
    let doneCount = 0
    try {
      const outcome = await runBatchEngine(
        files.map((f) => ({ name: f.file.name, buffer: f.buffer ?? new ArrayBuffer(0) })),
        async (_buffer, _name) => {
          current += 1
          const file = files[current]
          const index = current
          setBatchItems((prev) => prev?.map((item, i) => (i === index ? { ...item, status: 'working' } : item)) ?? prev)
          if (!file.buffer) throw new Error(file.error ?? `${file.file.name} could not be read.`)
          const out = await fn(file, controller.signal, (frac) => setProgress(Math.min(1, (doneCount + frac) / total)))
          return { blob: out.blob, filename: out.name, note: out.summary }
        },
        {
          signal: controller.signal,
          onProgress: (done) => { doneCount = done; setProgress(done / total) },
          onFileDone: (index, result) => {
            setBatchItems((prev) => prev?.map((item, i) => {
              if (i !== index) return item
              return 'error' in result
                ? { ...item, status: 'error', error: result.error }
                : { ...item, status: 'done', output: result }
            }) ?? prev)
          },
        },
      )
      if (controller.signal.aborted) return
      const succeeded = outcome.successes.length
      if (succeeded === 0) {
        setStatus('error')
        setJobError('None of the files could be processed. Each file is listed below with its problem.')
        toast.error('None of the files could be processed.')
      } else {
        setStatus('done'); setProgress(1)
        if (outcome.failures.length === 0) toast.success(`Done. ${succeeded} files are ready to download.`)
        else toast.info(`Done. ${succeeded} of ${total} files processed. The others are listed with their problems.`)
      }
    } catch {
      if (controller.signal.aborted) return
      setStatus('error')
      setJobError('Something went wrong while processing. Please try again.')
    }
  }, [files])

  return { files, addFiles, removeFile, moveFile, reset, status, progress, outputs, setOutputs, jobError, run, cancel, batchItems, runBatch }
}
