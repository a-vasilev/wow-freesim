import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// Token enforcement (docs/WEB_UI_PLAN.md §2): off-token COLORS already fail to
// compile because the default palette is stripped in src/theme/theme.css. These
// rules catch the rest — arbitrary Tailwind values and inline styles — so magic
// numbers can't be expressed in markup either.
const tokenEnforcement = [
  {
    selector:
      "JSXAttribute[name.name='className'] Literal[value=/\\[[^\\]]+\\]/]",
    message:
      'Arbitrary Tailwind values (e.g. w-[137px], text-[#abc]) are banned. Use a design token utility — see src/theme.',
  },
  {
    selector:
      "JSXAttribute[name.name='className'] TemplateElement[value.raw=/\\[[^\\]]+\\]/]",
    message:
      'Arbitrary Tailwind values (e.g. w-[137px], text-[#abc]) are banned. Use a design token utility — see src/theme.',
  },
  {
    selector: "JSXAttribute[name.name='style']",
    message:
      'Inline style is banned (off-token). Allowlist genuinely dynamic geometry (e.g. chart coords, raw token swatches) with an eslint-disable-next-line + justification.',
  },
]

export default tseslint.config(
  { ignores: ['dist', 'src/app/routeTree.gen.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-restricted-syntax': ['error', ...tokenEnforcement],
    },
  },
  {
    // File-based route modules export a `Route` object alongside their
    // component, which trips the fast-refresh rule. That export is required by
    // TanStack Router, so the rule is off for the routes directory.
    files: ['src/app/routes/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
)
