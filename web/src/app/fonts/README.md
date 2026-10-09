# Self-hosted fonts

These are the latin subsets of the site's three typefaces, in the same weights the site used before. They are loaded with `next/font/local` in `src/app/layout.tsx`, so a build never has to reach Google Fonts.

| File                                             | Source package (npm pack)          | Variable                |
| ------------------------------------------------ | ---------------------------------- | ----------------------- |
| `space-grotesk-latin-{500,600,700}-normal.woff2` | `@fontsource/space-grotesk@5.3.0`  | `--font-space-grotesk`  |
| `ibm-plex-sans-latin-{400,500,600}-normal.woff2` | `@fontsource/ibm-plex-sans@5.3.0`  | `--font-plex-sans`      |
| `jetbrains-mono-latin-{400,500}-normal.woff2`    | `@fontsource/jetbrains-mono@5.3.0` | `--font-jetbrains-mono` |

All three families are licensed under the SIL Open Font License 1.1. The licence for each family sits next to its files as `OFL-*.txt`.
