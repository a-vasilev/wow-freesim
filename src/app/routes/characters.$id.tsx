import { createFileRoute } from '@tanstack/react-router'
import { CharacterDetail } from '@/features/characters/CharacterDetail'

export const Route = createFileRoute('/characters/$id')({
  component: DetailRoute,
})

function DetailRoute() {
  const { id } = Route.useParams()
  return <CharacterDetail id={id} />
}
