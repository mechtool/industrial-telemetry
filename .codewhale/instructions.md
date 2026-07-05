# Project Instructions

## Angular Component Style Convention

All Angular components must use external files for templates and styles:

- **`templateUrl`** — always use `templateUrl: './<name>.component.html'`
- **`styleUrl`** — always use `styleUrl: './<name>.component.css'`

Never use inline `template` or `styles` in the `@Component` decorator. Each component gets its own `.component.css` file, placed alongside the `.ts` and `.html` files.
