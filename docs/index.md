---
layout: home

hero:
  name: hashup
  text: Deterministic import hashing
  tagline: Resolves every import and produces a fully deterministic hash for any entry file.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /api/
    - theme: alt
      text: GitHub
      link: https://github.com/maastrich/hashup

features:
  - title: Fully Deterministic
    details: Same inputs always produce the same SHA-256 hash — safe for caching, invalidation, and content addressing.
  - title: Transitive Resolution
    details: Walks every `import` in your entry file and all its dependencies using `enhanced-resolve`, respecting tsconfig paths, package exports, and conditional imports.
  - title: Multi-Format
    details: Handles `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.mts`, `.cjs`, `.json`, and more out of the box.
  - title: Extras Support
    details: Include arbitrary files (e.g. `package.json`, lockfiles, config) in the hash to catch environment changes.
---
