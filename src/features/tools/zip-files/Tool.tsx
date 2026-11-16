import ToolWorkspace from '../../shared/ToolWorkspace'
import { baseName } from '../../../lib/files'
import { getTool } from '../registry'
const tool = getTool('zip-files')!

export default function ZipFilesTool() {
  return (
    <ToolWorkspace
      tool={tool}
      notice="Any files can go into the archive — documents, pictures, whole folders' worth at once. The files are packed on your device and the archive is never uploaded. Files are stored flat, without folders, and a second file with the same name is kept with a number added, never overwritten."
      actionLabel={(files) => (files.length > 1 ? `Pack ${files.length} files into a ZIP` : 'Pack into a ZIP')}
      canRun={(files) => files.length >= 1 && files.every((f) => !!f.buffer)}
      onProcess={async (files, signal, onProgress) => {
        const { createZipArchive } = await import('./process')
        const data = await createZipArchive(
          files.map((f) => ({ name: f.file.name, data: new Uint8Array(f.buffer!) })),
        )
        if (signal.aborted) throw new Error('Cancelled')
        onProgress(1)
        const name = files.length === 1 ? `${baseName(files[0].file.name)}.zip` : 'files.zip'
        return [{
          name,
          blob: new Blob([data as BlobPart], { type: 'application/zip' }),
          summary: files.length === 1
            ? 'One file packed into a ZIP archive'
            : `${files.length} files packed into one ZIP archive`,
        }]
      }}
    />
  )
}
