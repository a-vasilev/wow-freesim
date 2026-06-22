import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { ThemeProvider } from '@/theme'
import { routeTree } from '@/app/routeTree.gen'
// Self-hosted fonts (bundled). CDN webfonts are blocked under COEP: require-corp,
// which cross-origin isolation requires — see vite.config.ts. Space Grotesk =
// display (--font-display), Inter = body (--font-sans).
import '@fontsource-variable/space-grotesk/index.css'
import '@fontsource-variable/inter/index.css'
import './theme/theme.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
)
