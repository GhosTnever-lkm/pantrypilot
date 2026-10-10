# PantryPilot

PantryPilot is a local-first weekly meal planner and grocery list. Add recipes, assign them to days and meals, adjust servings, and get a consolidated shopping list that subtracts ingredients already in your pantry.

## Run

Requires Node.js 20 or later. Run `npm start` in this folder and open `http://127.0.0.1:4173`. The static app can also be opened via GitHub Pages.

## Features

- Seven-day meal board with meal slots and serving counts.
- Recipe book with editable ingredient names, quantities, and units.
- Scale recipe amounts to planned servings.
- Consolidate equivalent supported units (g/kg, ml/l, spoon measures) by normalized ingredient name; keep incompatible dimensions separate.
- Subtract pantry stock from quantities to buy.
- Search, tick items off, copy or print a shopping list.
- Local browser persistence and validated JSON plan backup/restore.
- Example week and recipes ready to explore.

## Privacy and limits

The app has no account, analytics, recipe service, or server-side storage. Plans live in this browser's local storage. Clearing site data deletes them; export a JSON backup if you need to keep a plan. Import accepts PantryPilot schema version 1 only.

Ingredient merging is deliberately conservative. The app converts common mass, volume, count, tablespoon, and teaspoon units, but does not convert between mass and volume or infer that different ingredient names are equivalent. It does not provide nutritional, allergy, medical, dietary, or food-safety advice. Verify ingredients and quantities before shopping or cooking.

## Development

```sh
npm test
npm run check
```

MIT licensed. See [LICENSE](LICENSE).
