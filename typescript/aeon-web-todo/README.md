# AEON Web Todo

Svelte + Vite todo app that imports and exports todo lists as AEON documents.

The app uses:

```ts
import { readAeonChecked, writeAeon } from '@altopelago/aeon-sdk';
```

## Install

```bash
cd typescript/aeon-web-todo
npm install --ignore-scripts
```

## Run

```bash
npm run dev
```

Use `sample.todos.aeon` to try the import flow.

## Build

```bash
npm run build
```

## Storage Model

- Import reads a selected `.aeon` file with the browser File API.
- Changes are autosaved as an AEON browser draft in `localStorage`.
- Download emits the current list as `todos.aeon`.

No Tauri runtime or desktop filesystem bridge is required.
