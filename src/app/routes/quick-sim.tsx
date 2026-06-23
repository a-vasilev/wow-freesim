import { createFileRoute } from '@tanstack/react-router'
import { QuickSim } from '@/features/quick-sim/QuickSim'

export const Route = createFileRoute('/quick-sim')({
  component: QuickSim,
})
