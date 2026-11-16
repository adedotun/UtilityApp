import { Suspense, lazy, type ComponentType } from 'react'
import { useParams } from 'react-router-dom'
import { getTool } from './registry'
import NotFoundPage from './NotFoundPage'

/** Each tool is a lazy chunk, so PDF libraries load only when a tool opens. */
const COMPONENTS: Record<string, React.LazyExoticComponent<ComponentType>> = {
  'images-to-pdf': lazy(() => import('./images-to-pdf/Tool')),
  'pdf-to-images': lazy(() => import('./pdf-to-images/Tool')),
  'extract-images': lazy(() => import('./extract-images/Tool')),
  'pdf-to-text': lazy(() => import('./pdf-to-text/Tool')),
  'pdf-to-word': lazy(() => import('./pdf-to-word/Tool')),
  'pdf-to-excel': lazy(() => import('./pdf-to-excel/Tool')),
  'pdf-to-powerpoint': lazy(() => import('./pdf-to-powerpoint/Tool')),
  'ocr-pdf': lazy(() => import('./ocr-pdf/Tool')),
  'word-to-pdf': lazy(() => import('./word-to-pdf/Tool')),
  'view-word': lazy(() => import('./view-word/Tool')),
  'convert-image': lazy(() => import('./convert-image/Tool')),
  'compress-image': lazy(() => import('./compress-image/Tool')),
  'resize-image': lazy(() => import('./resize-image/Tool')),
  'exif-tools': lazy(() => import('./exif-tools/Tool')),
  'image-to-text': lazy(() => import('./image-to-text/Tool')),
  'watermark-image': lazy(() => import('./watermark-image/Tool')),
  'word-to-markdown': lazy(() => import('./word-to-markdown/Tool')),
  'markdown-to-pdf': lazy(() => import('./markdown-to-pdf/Tool')),
  'epub-viewer': lazy(() => import('./epub-viewer/Tool')),
  'merge-word': lazy(() => import('./merge-word/Tool')),
  'csv-to-excel': lazy(() => import('./csv-to-excel/Tool')),
  'excel-to-csv': lazy(() => import('./excel-to-csv/Tool')),
  'clean-csv': lazy(() => import('./clean-csv/Tool')),
  'zip-files': lazy(() => import('./zip-files/Tool')),
  'unzip-file': lazy(() => import('./unzip-file/Tool')),
  'file-hash': lazy(() => import('./file-hash/Tool')),
  'qr-generate': lazy(() => import('./qr-generate/Tool')),
  'qr-read': lazy(() => import('./qr-read/Tool')),
  'merge-pdf': lazy(() => import('./merge-pdf/Tool')),
  'split-pdf': lazy(() => import('./split-pdf/Tool')),
  'rotate-pdf': lazy(() => import('./rotate-pdf/Tool')),
  'extract-pages': lazy(() => import('./extract-pages/Tool')),
  'delete-pages': lazy(() => import('./delete-pages/Tool')),
  'remove-blank-pages': lazy(() => import('./remove-blank-pages/Tool')),
  'insert-pages': lazy(() => import('./insert-pages/Tool')),
  'reorder-pages': lazy(() => import('./reorder-pages/Tool')),
  'resize-pages': lazy(() => import('./resize-pages/Tool')),
  'n-up': lazy(() => import('./n-up/Tool')),
  'booklet-pdf': lazy(() => import('./booklet-pdf/Tool')),
  'split-by-bookmarks': lazy(() => import('./split-by-bookmarks/Tool')),
  'compare-pdfs': lazy(() => import('./compare-pdfs/Tool')),
  'edit-metadata': lazy(() => import('./edit-metadata/Tool')),
  'sign-pdf': lazy(() => import('./sign-pdf/Tool')),
  'edit-pdf': lazy(() => import('./edit-pdf/Tool')),
  'watermark': lazy(() => import('./watermark/Tool')),
  'page-numbers': lazy(() => import('./page-numbers/Tool')),
  'headers-footers': lazy(() => import('./headers-footers/Tool')),
  'crop-pdf': lazy(() => import('./crop-pdf/Tool')),
  'flatten-pdf': lazy(() => import('./flatten-pdf/Tool')),
  'fill-form': lazy(() => import('./fill-form/Tool')),
  'compress-pdf': lazy(() => import('./compress-pdf/Tool')),
  'repair-pdf': lazy(() => import('./repair-pdf/Tool')),
  'grayscale-pdf': lazy(() => import('./grayscale-pdf/Tool')),
  'prepare-to-share': lazy(() => import('./prepare-to-share/Tool')),
  'prepare-to-archive': lazy(() => import('./prepare-to-archive/Tool')),
  'password-protect': lazy(() => import('./password-protect/Tool')),
  'remove-password': lazy(() => import('./remove-password/Tool')),
  'redact-pdf': lazy(() => import('./redact-pdf/Tool')),
  'scrub-pdf': lazy(() => import('./scrub-pdf/Tool')),
}

export default function ToolPage() {
  const { slug } = useParams()
  const tool = slug ? getTool(slug) : undefined
  const Component = slug ? COMPONENTS[slug] : undefined
  if (!tool || !Component) return <NotFoundPage />
  return (
    <Suspense fallback={<p className="body-3" aria-busy="true">Loading this tool…</p>}>
      <Component />
    </Suspense>
  )
}
