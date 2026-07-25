// nutrition.js — cálculo de valores nutricionales y costo de recetas

const NUTRI_KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sodium'];

function emptyTotals() {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, cost: 0 };
}

// Calcula costo por unidad base (g, ml o unidad) de un ingrediente
function costPerBaseUnit(ingredient) {
  if (!ingredient || !ingredient.purchase || !ingredient.purchase.size) return 0;
  return ingredient.purchase.price / ingredient.purchase.size;
}

// Calcula factor nutricional por unidad base
// Convención: nutrition guardado por 100g/100ml (si baseUnit g/ml) o por 1 unidad (si baseUnit 'unidad')
function nutritionFactor(ingredient, amount) {
  if (!ingredient) return emptyTotals();
  const n = ingredient.nutrition || {};
  const divisor = ingredient.baseUnit === 'unidad' ? 1 : 100;
  const factor = amount / divisor;
  const out = {};
  NUTRI_KEYS.forEach(k => { out[k] = (n[k] || 0) * factor; });
  return out;
}

// items: [{ingredientId, amount}]  catalog: array de ingredientes
function computeTotals(items, catalog) {
  const totals = emptyTotals();
  const byId = new Map(catalog.map(i => [i.id, i]));
  const missing = [];
  (items || []).forEach(item => {
    const ing = byId.get(item.ingredientId);
    if (!ing) { missing.push(item.ingredientId); return; }
    const nf = nutritionFactor(ing, item.amount || 0);
    NUTRI_KEYS.forEach(k => { totals[k] += nf[k]; });
    totals.cost += costPerBaseUnit(ing) * (item.amount || 0);
  });
  return { totals, missing };
}

function perServing(totals, servings) {
  const s = servings && servings > 0 ? servings : 1;
  const out = {};
  Object.keys(totals).forEach(k => { out[k] = totals[k] / s; });
  return out;
}

function fmtGs(n) {
  const val = Math.round(n || 0);
  return '₲ ' + val.toLocaleString('es-PY');
}

function fmtNum(n, decimals = 1) {
  return (n || 0).toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

// Construye la lista efectiva de ingredientes de una receta después de aplicar
// los cambios de una prueba (tryout): montos/marca sobrescritos, quitados, y extras.
function buildEffectiveIngredients(recipe, tryout) {
  const changes = new Map((tryout?.ingredientChanges || []).map(c => [c.ingredientId, c]));
  const base = (recipe.ingredients || []).map(item => {
    const c = changes.get(item.ingredientId);
    if (c && c.removed) return null;
    return {
      ingredientId: item.ingredientId,
      amount: c && c.newAmount != null && c.newAmount !== '' ? c.newAmount : item.amount,
      brand: c && c.newBrand ? c.newBrand : item.brand
    };
  }).filter(Boolean);
  const extras = (tryout?.extraIngredients || []).map(e => ({ ingredientId: e.ingredientId, amount: e.amount, brand: e.brand }));
  return base.concat(extras);
}

window.Nutrition = { NUTRI_KEYS, computeTotals, perServing, costPerBaseUnit, fmtGs, fmtNum, emptyTotals, buildEffectiveIngredients };
