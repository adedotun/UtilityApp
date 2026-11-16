import { Suspense, lazy, type ComponentType } from 'react'
import { useParams } from 'react-router-dom'
import { getTool } from './registry'
import NotFoundPage from './NotFoundPage'

/** Each tool is a lazy chunk, so PDF libraries load only when a tool opens. */
const COMPONENTS: Record<string, React.LazyExoticComponent<ComponentType>> = {
  'images-to-pdf': lazy(() => import('./images-to-pdf/Tool')),
  'pdf-to-images': lazy(() => import('./pdf-to-images/Tool')),
  'word-to-pdf': lazy(() => import('./word-to-pdf/Tool')),
  'view-word': lazy(() => import('./view-word/Tool')),
  'merge-pdf': lazy(() => import('./merge-pdf/Tool')),
  'split-pdf': lazy(() => import('./split-pdf/Tool')),
  'rotate-pdf': lazy(() => import('./rotate-pdf/Tool')),
  'extract-pages': lazy(() => import('./extract-pages/Tool')),
  'reorder-pages': lazy(() => import('./reorder-pages/Tool')),
  'edit-metadata': lazy(() => import('./edit-metadata/Tool')),
  'sign-pdf': lazy(() => import('./sign-pdf/Tool')),
  'edit-pdf': lazy(() => import('./edit-pdf/Tool')),
  'watermark': lazy(() => import('./watermark/Tool')),
  'page-numbers': lazy(() => import('./page-numbers/Tool')),
  'crop-pdf': lazy(() => import('./crop-pdf/Tool')),
  'compress-pdf': lazy(() => import('./compress-pdf/Tool')),
  'password-protect': lazy(() => import('./password-protect/Tool')),
  'remove-password': lazy(() => import('./remove-password/Tool')),
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
