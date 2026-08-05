# Status page template

Static Svelte 5 SPA deployed by the SkinnyStatus admin portal.

## Develop

```sh
npm install
npm run dev
```

Edit `public/config.js` for local API base / slug.

## Build

From the repo root:

```sh
npm run build:status-template
```

Deploy injects a project-specific `config.js` (`apiBase`, `pageSlug`, `theme`, `basePath`) into `dist/` before uploading.
