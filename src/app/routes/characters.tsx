import { Outlet, createFileRoute } from '@tanstack/react-router'

/**
 * `/characters` layout. The index (`characters.index.tsx`) renders the library
 * and `characters.$id.tsx` the detail; this parent just hosts the outlet so a
 * child route replaces the index rather than rendering underneath it.
 */
export const Route = createFileRoute('/characters')({
  component: Outlet,
})
