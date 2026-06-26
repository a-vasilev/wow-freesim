import { createFileRoute } from '@tanstack/react-router'
import { CharacterLibrary } from '@/features/characters/CharacterLibrary'

export const Route = createFileRoute('/characters/')({
  component: CharacterLibrary,
})
