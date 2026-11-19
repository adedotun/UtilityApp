import { fileExtension } from '../../lib/files'

export type PreviewKind = 'image' | 'pdf' | 'none'

const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.heif'])

/**
 * Which visual preview, if any, the file list can show for a file.
 *
 * PDF wins when either signal says PDF — the same rule useWorkspace uses to
 * decide a file gets its pages counted. Images are recognised by MIME type
 * or extension, so a photo with a missing/generic MIME type still previews
 * from its name, and an uppercase extension works the same as lowercase.
 * HEIC/HEIF count as images: browsers that can decode them show the photo,
 * and the rest fall back to the generic icon in the component. Everything
 * else gets no preview — we never fake one for a format we do not render.
 */
export function previewKindFor(file: { name: string; type: string }): PreviewKind {
  const ext = fileExtension(file.name)
  if (file.type === 'application/pdf' || ext === '.pdf') return 'pdf'
  if (IMAGE_MIME_TYPES.has(file.type.toLowerCase()) || IMAGE_EXTENSIONS.has(ext)) return 'image'
  return 'none'
}
