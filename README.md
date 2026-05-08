# Xenpaper 2

Xenpaper 2 is a text-based microtonal sequencer for writing musical ideas, playing them in the browser, and sharing them by URL or embed code.

## Authors and contributors

- **Current author:** Lumi Pakkanen, who forked and maintains Xenpaper 2.
- **Original author and contributor:** Damien Clarke, creator of the [original project](https://github.com/dxinteractive/xenpaper).

Xenpaper 2 was forked from the original project in May 2026.

## AI Agent Disclosure

Portions of this project were developed with the assistance of [OpenAI Codex](https://openai.com/index/introducing-codex/) and ChatGPT. AI tools were used for tasks such as brainstorming, refactoring, debugging, and documentation, but all generated code and changes were reviewed, tested, and curated by human maintainers before inclusion in the project.

## Stack

Xenpaper 2 is built with Vue 3, Vite, TypeScript, Tone.js, Pinia, Vue Router, Peggy, and Vitest.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so this project replaces the `tsc` CLI with `vue-tsc` for type checking. In editors, [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) makes the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
