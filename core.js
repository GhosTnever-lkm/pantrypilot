'use strict';

const UNIT_ALIASES = new Map([
  ['g', ['mass', 'g']], ['gram', ['mass', 'g']], ['grams', ['mass', 'g']],
  ['kg', ['mass', 'g', 1000]], ['кг', ['mass', 'g', 1000]], ['г', ['mass', 'g']],
  ['ml', ['volume', 'ml']], ['мл', ['volume', 'ml']], ['l', ['volume', 'ml', 1000]], ['л', ['volume', 'ml', 1000]],
  ['pcs', ['count', 'pcs']], ['pc', ['count', 'pcs']], ['piece', ['count', 'pcs']], ['pieces', ['count', 'pcs']], ['шт', ['count', 'pcs']],
  ['clove', ['count', 'pcs']], ['cloves', ['count', 'pcs']], ['зубчик', ['count', 'pcs']], ['зубчика', ['count', 'pcs']],
  ['can', ['count', 'pcs']], ['cans', ['count', 'pcs']], ['банка', ['count', 'pcs']], ['банки', ['count', 'pcs']],
  ['tbsp', ['volume', 'ml', 15]], ['ст.л.', ['volume', 'ml', 15]], ['tsp', ['volume', 'ml', 5]], ['ч.л.', ['volume', 'ml', 5]],
]);

function normalizeIngredientName(value) {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function parseQuantity(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) throw new TypeError('Quantity must be a nonnegative finite number');
    return value;
  }
  const source = String(value ?? '').trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(source)) throw new TypeError('Quantity must be a nonnegative decimal number');
  const result = Number(source);
  if (!Number.isFinite(result)) throw new TypeError('Quantity must be finite');
  return result;
}

function canonicalAmount(quantity, unit) {
  const normalized = String(unit || '').normalize('NFKC').trim().toLocaleLowerCase();
  const info = UNIT_ALIASES.get(normalized);
  if (!info) return { dimension: `unit:${normalized}`, unit: normalized || 'unit', amount: quantity };
  const [dimension, canonical, multiplier = 1] = info;
  return { dimension, unit: canonical, amount: quantity * multiplier };
}

function scaleRecipe(recipe, servings) {
  const target = parseQuantity(servings);
  const base = parseQuantity(recipe?.servings);
  if (target <= 0 || base <= 0) throw new RangeError('Servings must be greater than zero');
  if (!Array.isArray(recipe.ingredients)) throw new TypeError('Recipe ingredients must be an array');
  const factor = target / base;
  return recipe.ingredients.map((ingredient) => {
    const name = String(ingredient.name || '').trim();
    if (!name) throw new TypeError('Ingredient name is required');
    const quantity = parseQuantity(ingredient.quantity);
    const unit = String(ingredient.unit || '').trim();
    return { name, key: normalizeIngredientName(name), quantity: quantity * factor, unit, category: String(ingredient.category || 'Другое').trim() || 'Другое' };
  });
}

function aggregateShoppingList(meals, pantry = []) {
  const have = new Map();
  for (const item of pantry) {
    const key = normalizeIngredientName(item.name);
    if (!key) continue;
    const parsed = canonicalAmount(parseQuantity(item.quantity), item.unit);
    const compound = `${key}\0${parsed.dimension}`;
    have.set(compound, (have.get(compound) || 0) + parsed.amount);
  }
  const needed = new Map();
  for (const meal of meals || []) {
    const servings = parseQuantity(meal.servings);
    const recipeServings = parseQuantity(meal.recipe.servings);
    if (recipeServings <= 0) throw new RangeError('Recipe servings must be greater than zero');
    for (const item of scaleRecipe(meal.recipe, servings)) {
      const parsed = canonicalAmount(item.quantity, item.unit);
      const compound = `${item.key}\0${parsed.dimension}`;
      const current = needed.get(compound) || { name: item.name, key: item.key, dimension: parsed.dimension, unit: parsed.unit, amount: 0, category: item.category, sources: [] };
      current.amount += parsed.amount;
      current.sources.push(meal.recipe.name || 'Recipe');
      needed.set(compound, current);
    }
  }
  return [...needed.entries()].map(([compound, item]) => {
    const remaining = Math.max(0, item.amount - (have.get(compound) || 0));
    return { ...item, needed: item.amount, onHand: Math.min(item.amount, have.get(compound) || 0), quantity: remaining, sources: [...new Set(item.sources)] };
  }).filter((item) => item.quantity > 1e-9).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function makeId(prefix = 'id') {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function validateRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return { valid: false, errors: ['Recipe must be an object'] };
  const errors = [];
  if (typeof recipe.name !== 'string' || !recipe.name.trim()) errors.push('Recipe name is required');
  try { if (parseQuantity(recipe.servings) <= 0) errors.push('Recipe servings must be greater than zero'); } catch { errors.push('Recipe servings must be a valid number'); }
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) errors.push('At least one ingredient is required');
  else recipe.ingredients.forEach((item, i) => {
    if (!item || typeof item.name !== 'string' || !item.name.trim()) errors.push(`Ingredient ${i + 1} needs a name`);
    try { parseQuantity(item.quantity); } catch { errors.push(`Ingredient ${i + 1} has an invalid quantity`); }
    if (typeof item.unit !== 'string') errors.push(`Ingredient ${i + 1} needs a unit`);
  });
  return { valid: errors.length === 0, errors };
}

function createRecipe(name, servings, ingredients) {
  const recipe = { id: makeId('recipe'), name: String(name || '').trim(), servings: parseQuantity(servings), ingredients: ingredients.map((item) => ({ name: String(item.name || '').trim(), quantity: parseQuantity(item.quantity), unit: String(item.unit || '').trim(), category: String(item.category || 'Другое') })) };
  const validation = validateRecipe(recipe);
  if (!validation.valid) throw new TypeError(validation.errors.join('; '));
  return recipe;
}

function exportPlan(plan) {
  return JSON.stringify({ schema: 'pantrypilot-plan', version: 1, plan }, null, 2);
}

function importPlan(source) {
  let parsed;
  try { parsed = JSON.parse(source); } catch { throw new TypeError('File is not valid JSON'); }
  if (!parsed || parsed.schema !== 'pantrypilot-plan' || parsed.version !== 1 || !parsed.plan || !Array.isArray(parsed.plan.meals) || !Array.isArray(parsed.plan.recipes) || !Array.isArray(parsed.plan.pantry)) throw new TypeError('Unsupported or invalid PantryPilot backup');
  if (parsed.plan.checked !== undefined && (!Array.isArray(parsed.plan.checked) || parsed.plan.checked.some((id) => typeof id !== 'string'))) throw new TypeError('Invalid checked shopping items in backup');
  for (const recipe of parsed.plan.recipes) {
    const result = validateRecipe(recipe);
    if (!result.valid) throw new TypeError(result.errors.join('; '));
  }
  const pantryIds = new Set();
  for (const item of parsed.plan.pantry) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.id !== 'string' || !item.id || pantryIds.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || typeof item.unit !== 'string') throw new TypeError('Invalid pantry item in backup');
    try { parseQuantity(item.quantity); } catch { throw new TypeError('Invalid pantry item quantity in backup'); }
    pantryIds.add(item.id);
  }
  const recipeIds = new Set(parsed.plan.recipes.map((recipe) => recipe.id));
  for (const meal of parsed.plan.meals) if (!recipeIds.has(meal.recipeId) || !(parseQuantity(meal.servings) > 0) || !['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(meal.day)) throw new TypeError('Invalid meal assignment in backup');
  return parsed.plan;
}

const PantryPilotCore = { normalizeIngredientName, parseQuantity, canonicalAmount, scaleRecipe, aggregateShoppingList, makeId, validateRecipe, createRecipe, exportPlan, importPlan };
if (typeof module !== 'undefined' && module.exports) module.exports = PantryPilotCore;
if (typeof window !== 'undefined') window.PantryPilotCore = PantryPilotCore;
