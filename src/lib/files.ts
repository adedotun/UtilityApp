export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

/** Returns a problem string, or null when the file is acceptable for the tool. */
export function validateFile(file: File, accept: string[]): string | null {
  const ext = fileExtension(file.name)
  const ok = accept.some((a) => {
    if (a.startsWith('.')) return ext === a.toLowerCase()
    if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1))
    return file.type === a
  })
  if (!ok) return `${file.name} is not a supported file type for this tool.`
  if (file.size === 0) return `${file.name} is empty.`
  if (file.size > 200 * 1024 * 1024) return `${file.name} is over the 200 MB working limit.`
  return null
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function baseName(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

let counter = 0
export function uid(): string {
  counter += 1
  return `f${Date.now().toString(36)}-${counter}`
}
