import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './features/home/HomePage'
import PrivacyPage from './features/home/PrivacyPage'
import ToolPage from './features/tools/ToolPage'
import NotFoundPage from './features/tools/NotFoundPage'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'tools/:slug', element: <ToolPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
