import { createFileRoute } from '@tanstack/react-router'
import { StartSim } from '@/features/start/StartSim'

export const Route = createFileRoute('/simulate')({
  component: StartSim,
})
