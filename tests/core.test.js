'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = require('../core');

test('package version, VERSION, and newest changelog entry stay aligned', () => {
  const pkg = JSON.parse(fs.readFileSync(require.resolve('../package.json'), 'utf8'));
  const version = fs.readFileSync(require.resolve('../VERSION'), 'utf8').trim();
  const changelog = fs.readFileSync(require.resolve('../CHANGELOG.md'), 'utf8');
  assert.equal(pkg.version, version);
  assert.match(changelog, new RegExp(`^## ${pkg.version.replaceAll('.', '\\.')} - `, 'm'));
});

test('scales ingredient amounts for serving count', () => {
  const result = core.scaleRecipe({ servings: 2, ingredients: [{ name: 'Rice', quantity: 100, unit: 'g' }] }, 5);
  assert.equal(result[0].quantity, 250);
});

test('normalizes names and merges supported equivalent mass units', () => {
  const meals = [
    { servings: 2, recipe: { name: 'A', servings: 2, ingredients: [{ name: 'Rice', quantity: 200, unit: 'g' }] } },
    { servings: 3, recipe: { name: 'B', servings: 3, ingredients: [{ name: ' rice ', quantity: 0.5, unit: 'kg' }] } },
  ];
  const rows = core.aggregateShoppingList(meals);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity, 700);
  assert.equal(rows[0].unit, 'g');
});

test('subtracts matching pantry stock but keeps incompatible units separate', () => {
  const meals = [{ servings: 1, recipe: { servings: 1, ingredients: [{ name: 'Milk', quantity: 500, unit: 'ml' }, { name: 'Milk', quantity: 1, unit: 'cup' }] } }];
  const rows = core.aggregateShoppingList(meals, [{ name: 'milk', quantity: 0.2, unit: 'l' }]);
  assert.equal(rows.find((x) => x.unit === 'ml').quantity, 300);
  assert.equal(rows.find((x) => x.unit === 'cup').quantity, 1);
});

test('keeps count and mass quantities distinct', () => {
  const rows = core.aggregateShoppingList([{ servings: 1, recipe: { servings: 1, ingredients: [{ name: 'Egg', quantity: 2, unit: 'pcs' }, { name: 'Egg', quantity: 100, unit: 'g' }] } }]);
  assert.equal(rows.length, 2);
});

test('supports decimal comma and rejects negative or malformed quantities', () => {
  assert.equal(core.parseQuantity('1,25'), 1.25);
  assert.throws(() => core.parseQuantity('-1'));
  assert.throws(() => core.parseQuantity('1/2'));
});

test('rejects quantity conversions and totals that overflow finite numbers', () => {
  assert.throws(() => core.canonicalAmount(1e308, 'kg'), /too large/);
  assert.throws(() => core.scaleRecipe({ servings: 1, ingredients: [{ name: 'Rice', quantity: 1e308, unit: 'g' }] }, 2), /too large/);
  assert.throws(() => core.aggregateShoppingList([
    { servings: 1, recipe: { servings: 1, ingredients: [{ name: 'Rice', quantity: 1e308, unit: 'g' }] } },
    { servings: 1, recipe: { servings: 1, ingredients: [{ name: 'rice', quantity: 1e308, unit: 'g' }] } },
  ]), /too large/);
});

test('rejects empty recipes and invalid recipe structures', () => {
  assert.throws(() => core.createRecipe('', 0, []));
  assert.deepEqual(core.validateRecipe({}).valid, false);
});

test('backup export/import round-trips and validates assigned meals', () => {
  const recipe = core.createRecipe('Soup', 2, [{ name: 'Water', quantity: 1, unit: 'l' }]);
  const plan = { recipes: [recipe], meals: [{ id: 'm', recipeId: recipe.id, day: 'mon', slot: 'dinner', servings: 4 }], pantry: [] };
  assert.deepEqual(core.importPlan(core.exportPlan(plan)), plan);
  const bad = JSON.parse(core.exportPlan(plan)); bad.plan.meals[0].day = 'holiday';
  assert.throws(() => core.importPlan(JSON.stringify(bad)));
});

test('shopping list records source recipes and excludes fully stocked items', () => {
  const rows = core.aggregateShoppingList([{ servings: 1, recipe: { name: 'Salad', servings: 1, ingredients: [{ name: 'Salt', quantity: 3, unit: 'g' }] } }], [{ name: 'salt', quantity: 5, unit: 'g' }]);
  assert.equal(rows.length, 0);
});
