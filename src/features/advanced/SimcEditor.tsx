import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'

/**
 * Raw `.simc` editor (WEB_UI_PLAN U4) on CodeMirror 6, feeding the same
 * inspect()/run() path as the paste box. Themed from tokens via CSS vars (a
 * CodeMirror theme is a JS style object, so it carries var() strings — no raw
 * colors). simc syntax highlighting is a later enhancement (§10).
 */
const tokenTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--c-surface-inset)',
      color: 'var(--c-fg)',
      fontSize: '13px',
      border: '1px solid var(--c-border-subtle)',
      borderRadius: '6px',
    },
    '&.cm-focused': { outline: 'none', borderColor: 'var(--c-border)' },
    '.cm-content': {
      fontFamily: 'var(--font-mono)',
      caretColor: 'var(--c-accent)',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--c-fg-faint)',
      border: 'none',
    },
    '.cm-activeLine': { backgroundColor: 'var(--c-surface-overlay)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'var(--c-accent-subtle)',
    },
  },
  { dark: true },
)

export function SimcEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!host.current) return
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        tokenTheme,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString())
        }),
        EditorView.lineWrapping,
      ],
    })
    const v = new EditorView({ state, parent: host.current })
    view.current = v
    return () => v.destroy()
    // Mount once; external value changes are synced in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the editor in sync when value changes from outside (e.g. "Load example").
  useEffect(() => {
    const v = view.current
    if (v && value !== v.state.doc.toString()) {
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: value },
      })
    }
  }, [value])

  return <div ref={host} className="overflow-hidden rounded-lg" />
}
