import { createFileRoute } from '@tanstack/react-router'
import { TopGear } from '@/features/gear/TopGear'

export const Route = createFileRoute('/gear')({
  component: TopGear,
})
