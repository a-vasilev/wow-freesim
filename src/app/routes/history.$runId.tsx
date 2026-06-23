import { createFileRoute } from '@tanstack/react-router'
import { HistoryRunView } from '@/features/history/HistoryRunView'

export const Route = createFileRoute('/history/$runId')({
  component: RunRoute,
})

function RunRoute() {
  const { runId } = Route.useParams()
  return <HistoryRunView runId={runId} />
}
