// db.js — capa de almacenamiento (localStorage)
// Todas las colecciones viven bajo claves "migaja_*" para no chocar con otras apps.

const KEYS = {
  ingredients: 'migaja_ingredients',
  recipes: 'migaja_recipes',
  tryouts: 'migaja_tryouts',
  breadTryouts: 'migaja_bread_tryouts',
  backups: 'migaja_backups',
  meta: 'migaja_meta'
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readCollection(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error leyendo', key, e);
    return [];
  }
}

function writeCollection(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Error guardando', key, e);
    return false;
  }
}

function readMeta() {
  try {
    const raw = localStorage.getItem(KEYS.meta);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function writeMeta(meta) {
  localStorage.setItem(KEYS.meta, JSON.stringify(meta));
}

const DB = {
  KEYS, uid,

  // Ingredientes
  getIngredients() { return readCollection(KEYS.ingredients); },
  saveIngredients(list) { return writeCollection(KEYS.ingredients, list); },
  upsertIngredient(ing) {
    const list = DB.getIngredients();
    const idx = list.findIndex(i => i.id === ing.id);
    if (idx >= 0) list[idx] = ing; else list.push(ing);
    DB.saveIngredients(list);
    return ing;
  },
  deleteIngredient(id) {
    DB.saveIngredients(DB.getIngredients().filter(i => i.id !== id));
  },

  // Recetas
  getRecipes() { return readCollection(KEYS.recipes); },
  saveRecipes(list) { return writeCollection(KEYS.recipes, list); },
  upsertRecipe(recipe) {
    const list = DB.getRecipes();
    const idx = list.findIndex(r => r.id === recipe.id);
    recipe.updatedAt = new Date().toISOString();
    if (idx >= 0) list[idx] = recipe; else { recipe.createdAt = recipe.updatedAt; list.push(recipe); }
    DB.saveRecipes(list);
    return recipe;
  },
  deleteRecipe(id) {
    DB.saveRecipes(DB.getRecipes().filter(r => r.id !== id));
  },

  // Pruebas / tryouts generales
  getTryouts() { return readCollection(KEYS.tryouts); },
  saveTryouts(list) { return writeCollection(KEYS.tryouts, list); },
  upsertTryout(t) {
    const list = DB.getTryouts();
    const idx = list.findIndex(x => x.id === t.id);
    if (idx >= 0) list[idx] = t; else list.push(t);
    DB.saveTryouts(list);
    return t;
  },
  deleteTryout(id) {
    DB.saveTryouts(DB.getTryouts().filter(t => t.id !== id));
  },

  // Pruebas de pan (extienden tryouts con datos específicos)
  getBreadTryouts() { return readCollection(KEYS.breadTryouts); },
  saveBreadTryouts(list) { return writeCollection(KEYS.breadTryouts, list); },
  upsertBreadTryout(t) {
    const list = DB.getBreadTryouts();
    const idx = list.findIndex(x => x.id === t.id);
    if (idx >= 0) list[idx] = t; else list.push(t);
    DB.saveBreadTryouts(list);
    return t;
  },
  deleteBreadTryout(id) {
    DB.saveBreadTryouts(DB.getBreadTryouts().filter(t => t.id !== id));
  },

  // Backups
  getBackups() { return readCollection(KEYS.backups); },
  saveBackups(list) { return writeCollection(KEYS.backups, list); },

  // Meta (última fecha de backup, etc.)
  getMeta: readMeta,
  setMeta: writeMeta,

  // Export/import de todo
  exportAll() {
    return {
      app: 'migaja',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        ingredients: DB.getIngredients(),
        recipes: DB.getRecipes(),
        tryouts: DB.getTryouts(),
        breadTryouts: DB.getBreadTryouts()
      }
    };
  },
  importAll(payload, { merge = false } = {}) {
    if (!payload || !payload.data) throw new Error('Archivo de respaldo inválido');
    const d = payload.data;
    if (merge) {
      const mergeList = (existing, incoming) => {
        const map = new Map(existing.map(x => [x.id, x]));
        (incoming || []).forEach(x => map.set(x.id, x));
        return Array.from(map.values());
      };
      DB.saveIngredients(mergeList(DB.getIngredients(), d.ingredients));
      DB.saveRecipes(mergeList(DB.getRecipes(), d.recipes));
      DB.saveTryouts(mergeList(DB.getTryouts(), d.tryouts));
      DB.saveBreadTryouts(mergeList(DB.getBreadTryouts(), d.breadTryouts));
    } else {
      DB.saveIngredients(d.ingredients || []);
      DB.saveRecipes(d.recipes || []);
      DB.saveTryouts(d.tryouts || []);
      DB.saveBreadTryouts(d.breadTryouts || []);
    }
  },

  seedIfEmpty() {
    if (DB.getIngredients().length > 0) return;
    DB.saveIngredients(DB.baselineIngredients());
  },

  // Ingredientes base sugeridos. Se usan tanto para la siembra inicial
  // como para completar catálogos ya existentes que todavía no los tengan.
  baselineIngredients() {
    const now = new Date().toISOString();
    return [
      { id: uid(), name: 'Harina de arroz', category: 'harina', baseUnit: 'g', purchase: { price: 12000, size: 1000 }, nutrition: { kcal: 366, protein: 6, carbs: 80, fat: 1.4, fiber: 2.4, sodium: 5 }, brand: '', createdAt: now },
      { id: uid(), name: 'Almidón de mandioca', category: 'almidon', baseUnit: 'g', purchase: { price: 9000, size: 1000 }, nutrition: { kcal: 340, protein: 0.3, carbs: 84, fat: 0.1, fiber: 1, sodium: 1 }, brand: '', createdAt: now },
      { id: uid(), name: 'Fécula de maíz', category: 'almidon', baseUnit: 'g', purchase: { price: 8500, size: 500 }, nutrition: { kcal: 381, protein: 0.3, carbs: 91, fat: 0.1, fiber: 0.9, sodium: 9 }, brand: '', createdAt: now },
      { id: uid(), name: 'Fécula de papa', category: 'almidon', baseUnit: 'g', purchase: { price: 9500, size: 1000 }, nutrition: { kcal: 343, protein: 0.1, carbs: 83, fat: 0.1, fiber: 3, sodium: 6 }, brand: '', createdAt: now },
      { id: uid(), name: 'Psyllium husk powder', category: 'aditivo', baseUnit: 'g', purchase: { price: 35000, size: 250 }, nutrition: { kcal: 296, protein: 2.7, carbs: 88, fat: 0.5, fiber: 71, sodium: 21 }, brand: '', createdAt: now },
      { id: uid(), name: 'Psyllium husk cáscara', category: 'aditivo', baseUnit: 'g', purchase: { price: 32000, size: 250 }, nutrition: { kcal: 296, protein: 2.7, carbs: 88, fat: 0.5, fiber: 71, sodium: 21 }, brand: '', createdAt: now },
      { id: uid(), name: 'Goma xántica', category: 'aditivo', baseUnit: 'g', purchase: { price: 45000, size: 200 }, nutrition: { kcal: 336, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }, brand: '', createdAt: now },
      { id: uid(), name: 'Levadura seca', category: 'leudante', baseUnit: 'g', purchase: { price: 18000, size: 125 }, nutrition: { kcal: 325, protein: 40, carbs: 41, fat: 7, fiber: 27, sodium: 51 }, brand: '', createdAt: now },
      { id: uid(), name: 'Huevo', category: 'liquido', baseUnit: 'unidad', purchase: { price: 1200, size: 1 }, nutrition: { kcal: 78, protein: 6.3, carbs: 0.6, fat: 5.3, fiber: 0, sodium: 62 }, brand: '', createdAt: now },
      { id: uid(), name: 'Leche entera', category: 'liquido', baseUnit: 'ml', purchase: { price: 7500, size: 1000 }, nutrition: { kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, sodium: 43 }, brand: '', createdAt: now },
      { id: uid(), name: 'Aceite de girasol', category: 'grasa', baseUnit: 'ml', purchase: { price: 14000, size: 900 }, nutrition: { kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sodium: 0 }, brand: '', createdAt: now },
      { id: uid(), name: 'Azúcar', category: 'endulzante', baseUnit: 'g', purchase: { price: 6500, size: 1000 }, nutrition: { kcal: 387, protein: 0, carbs: 100, fat: 0, fiber: 0, sodium: 0 }, brand: '', createdAt: now },
      { id: uid(), name: 'Sal', category: 'otro', baseUnit: 'g', purchase: { price: 3000, size: 500 }, nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 38758 }, brand: '', createdAt: now }
    ];
  },

  // Agrega ingredientes base que todavía no existan en el catálogo (por nombre),
  // sin duplicar ni tocar los que el usuario ya tiene editados.
  ensureBaselineIngredients() {
    const existing = DB.getIngredients();
    const existingNames = new Set(existing.map(i => i.name.trim().toLowerCase()));
    const missing = DB.baselineIngredients().filter(i => !existingNames.has(i.name.trim().toLowerCase()));
    if (missing.length) DB.saveIngredients(existing.concat(missing));
    return missing.length;
  }
};

window.DB = DB;
