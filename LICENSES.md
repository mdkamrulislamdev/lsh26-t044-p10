# Third-party licenses

This project uses only permissively licensed dependencies and fonts. No AGPL, GPL, LGPL, MPL, SSPL, other copyleft / weak-copyleft licenses, or non-commercial / personal-use-only assets are included.

All application source in this repository is original work for LofiStack Hackathon 2026 (Problem P10) unless listed below.

## Runtime dependencies

| Package | License | Use |
|---|---|---|
| [react](https://www.npmjs.com/package/react) | MIT | UI |
| [react-dom](https://www.npmjs.com/package/react-dom) | MIT | UI |
| [recharts](https://www.npmjs.com/package/recharts) | MIT | Balance history chart |

## Build / toolchain

| Package | License |
|---|---|
| [vite](https://www.npmjs.com/package/vite) | MIT |
| [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) | MIT |
| [tailwindcss](https://www.npmjs.com/package/tailwindcss) | MIT |
| [@tailwindcss/vite](https://www.npmjs.com/package/@tailwindcss/vite) | MIT |
| [typescript](https://www.npmjs.com/package/typescript) | Apache-2.0 |
| [oxlint](https://www.npmjs.com/package/oxlint) | MIT |
| [@types/node](https://www.npmjs.com/package/@types/node) | MIT |
| [@types/react](https://www.npmjs.com/package/@types/react) | MIT |
| [@types/react-dom](https://www.npmjs.com/package/@types/react-dom) | MIT |

Transitive packages are those installed by npm from the licenses of the packages above. None are known to be copyleft.

## Fonts

| Asset | License | Source |
|---|---|---|
| Source Serif 4 | SIL Open Font License 1.1 | [Google Fonts](https://fonts.google.com/specimen/Source+Serif+4) |
| DM Sans | SIL Open Font License 1.1 | [Google Fonts](https://fonts.google.com/specimen/DM+Sans) |

## Data

`docs/P10_prepaid_meter_public.json` is the public P10 case file from the problem pack. It is gitignored and used only by `npm run test:engine`. The app ships `src/data/household.json`.
