# Third-party licenses

Team **lsh26-t044** · Problem **p10**

This file lists every framework, library, starter, template, font, icon and asset used in this repository. No AGPL, GPL, LGPL, MPL, SSPL, copyleft, or non-commercial-only assets are included.

Original MeterWise application source is licensed under the **MIT License**. See [`LICENSE`](./LICENSE) (this file sits beside the README).

Application source in `src/` (except third-party packages) is original work for LofiStack Hackathon 2026 unless listed below.

## Starter / template

| Item | License | Use |
|---|---|---|
| Vite official React + TypeScript app template | MIT | Pre-event scaffolding (`index.html`, Vite config, `npm run dev`). Not a prebuilt P10 solution. Declared in `EVENT.md`. |

No UI kit (no shadcn, no MUI, no Bootstrap). Layout and tabs are original Tailwind in `src/App.tsx`.

## Runtime libraries

| Package | License | Use |
|---|---|---|
| [react](https://www.npmjs.com/package/react) | MIT | UI |
| [react-dom](https://www.npmjs.com/package/react-dom) | MIT | UI |
| [recharts](https://www.npmjs.com/package/recharts) | MIT | Daily balance line and recharge marks |

Recharts pulls in MIT-licensed helpers (including `clsx`, `decimal.js-light`, and d3-scale / d3-shape / d3-path / d3-time). None are copyleft.

## Build / toolchain

| Package | License | Use |
|---|---|---|
| [vite](https://www.npmjs.com/package/vite) | MIT | Dev server and production build |
| [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) | MIT | React plugin |
| [tailwindcss](https://www.npmjs.com/package/tailwindcss) | MIT | CSS |
| [@tailwindcss/vite](https://www.npmjs.com/package/@tailwindcss/vite) | MIT | Tailwind Vite plugin |
| [typescript](https://www.npmjs.com/package/typescript) | Apache-2.0 | Types |
| [tsx](https://www.npmjs.com/package/tsx) | MIT | `npm test` / `npm run test:engine` |
| [oxlint](https://www.npmjs.com/package/oxlint) | MIT | Lint |
| [@types/node](https://www.npmjs.com/package/@types/node) | MIT | Types |
| [@types/react](https://www.npmjs.com/package/@types/react) | MIT | Types |
| [@types/react-dom](https://www.npmjs.com/package/@types/react-dom) | MIT | Types |

## Fonts

Loaded from Google Fonts in `index.html` (not bundled as binary files).

| Asset | License | Source |
|---|---|---|
| DM Sans | SIL Open Font License 1.1 | [Google Fonts](https://fonts.google.com/specimen/DM+Sans) |
| Source Serif 4 | SIL Open Font License 1.1 | [Google Fonts](https://fonts.google.com/specimen/Source+Serif+4) |

## Icons and graphics

| Asset | License | Use |
|---|---|---|
| `public/favicon.svg` | Original (this team) | Tab icon: green square + bolt path |
| Header bolt in `src/App.tsx` | Original (this team) | Inline SVG, not an icon font or Lucide pack |

No Lucide, Heroicons, Font Awesome, or image stock. No `hero.png`.

## Data

| Asset | License / source | Use |
|---|---|---|
| `src/data/household.json` | Original (this team) | Built-in six-month Dhaka household |
| `docs/P10_prepaid_meter_public.json` | Problem pack (gitignored) | Local `npm test` only |
| `evaluation-manifest.json` | Original (this team) | Judge evaluation pack |
| `proof_images/1.png` … `4.png` | Original screenshots (this team) | README proof of the four required tabs |

## Hosting

Vercel (live URL). No extra client SDK in the app.

## AI assistant

Cursor was used while writing code and docs. Tariff rules, formulas, and behaviour in `src/billingEngine.ts` are implemented in this repository and remain the team’s responsibility.

## Secrets

None. No API keys, tokens, passwords, or personal data in the repo.
