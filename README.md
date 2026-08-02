## Tech stack

- [Modelence](https://modelence.com/) full-stack framework
- React 19 + React Router
- Vite + Tailwind CSS v4
- TypeScript
- HTML5 Canvas + `requestAnimationFrame` for the game engine
- Optional Expo / React Native mobile app (in `mobile/`)

## Getting started

### Prerequisites

- Node.js 20+

### Install & run

```bash
npm install
npm run dev
```

This starts the Modelence dev server. Open the printed local URL in your browser to play.

### Build & start (production)

```bash
npm run build
npm run start
```

## Project structure

```
.
├── src/
│   ├── client/
│   │   ├── game/        # Game engine, split by domain
│   │   │   ├── engine.ts      # PitchKickGame: loop, physics, input, AI, rules
│   │   │   ├── render.ts      # Pure canvas renderer (broadcast camera)
│   │   │   ├── projection.ts  # TV camera projection & clamps
│   │   │   ├── constants.ts   # World scale / geometry / physics tunables
│   │   │   ├── math.ts        # Pure math helpers
│   │   │   └── types.ts       # Shared game types
│   │   └── pages/
│   │       └── HomePage.tsx   # Canvas host, HUD, menus, team select
│   └── server/          # Modelence  backend modules
└── modelence.config.ts
```
