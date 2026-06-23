import { createFileRoute } from '@tanstack/react-router'
import { Advanced } from '@/features/advanced/Advanced'

export const Route = createFileRoute('/advanced')({
  component: Advanced,
})
