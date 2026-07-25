// recipes.js — recetas, cálculo nutricional y de costo, detalle

const RECIPE_CATEGORIES = {
  pan: 'Pan', pastel: 'Pastel/Torta', galleta: 'Galleta', pasta: 'Pasta/Masa',
  salado: 'Salado', otro: 'Otro'
};

const Recipes = {
  filterCategory: 'todas',

  render() {
    const el = document.getElementById('view-recetas');
    const list = DB.getRecipes().sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const filtered = Recipes.filterCategory === 'todas' ? list : list.filter(r => r.category === Recipes.filterCategory);

    el.innerHTML = `
      <div class="section-head">
        <h2>Recetas</h2>
        <button class="btn small" id="btnNewRecipe">+ Receta</button>
      </div>
      <div class="chip-select" style="margin-bottom:12px;" id="recCatFilter">
        <button class="chip ${Recipes.filterCategory==='todas'?'on':''}" data-cat="todas">Todas</button>
        ${Object.entries(RECIPE_CATEGORIES).map(([k,v]) => `<button class="chip ${Recipes.filterCategory===k?'on':''}" data-cat="${k}">${v}</button>`).join('')}
      </div>
      <div id="recList"></div>
    `;

    const listEl = el.querySelector('#recList');
    const catalog = DB.getIngredients();
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty"><div class="glyph">📖</div><p>Todavía no hay recetas ${Recipes.filterCategory !== 'todas' ? 'en esta categoría' : ''}.</p></div>`;
    } else {
      listEl.innerHTML = filtered.map(r => {
        const { totals } = Nutrition.computeTotals(r.ingredients, catalog);
        const per = Nutrition.perServing(totals, r.servings);
        return `
        <div class="card tap" data-id="${r.id}">
          <div class="row between">
            <div>
              <div class="card-title">${r.name}</div>
              <span class="badge">${RECIPE_CATEGORIES[r.category] || 'Otro'}</span>
              ${r.isBread ? '<span class="badge terracotta">🍞 Pan</span>' : ''}
            </div>
            <div class="stat">
              <div class="num mono">${Nutrition.fmtGs(per.cost)}</div>
              <div class="lbl">por porción</div>
            </div>
          </div>
          <div class="stat-row">
            <div class="stat"><div class="num mono">${Nutrition.fmtNum(per.kcal,0)}</div><div class="lbl">kcal</div></div>
            <div class="stat"><div class="num mono">${Nutrition.fmtNum(per.protein)}g</div><div class="lbl">prot</div></div>
            <div class="stat"><div class="num mono">${Nutrition.fmtNum(per.carbs)}g</div><div class="lbl">carb</div></div>
            <div class="stat"><div class="num mono">${Nutrition.fmtNum(per.fat)}g</div><div class="lbl">grasa</div></div>
          </div>
        </div>`;
      }).join('');
    }

    el.querySelector('#btnNewRecipe').onclick = () => Recipes.openForm();
    el.querySelectorAll('#recCatFilter .chip').forEach(btn => {
      btn.onclick = () => { Recipes.filterCategory = btn.dataset.cat; Recipes.render(); };
    });
    listEl.querySelectorAll('.card').forEach(card => {
      card.onclick = () => Recipes.openDetail(card.dataset.id);
    });
  },

  openDetail(id) {
    const r = DB.getRecipes().find(x => x.id === id);
    if (!r) return;
    const catalog = DB.getIngredients();
    const byId = new Map(catalog.map(i => [i.id, i]));
    const { totals, missing } = Nutrition.computeTotals(r.ingredients, catalog);
    const per = Nutrition.perServing(totals, r.servings);
    const tryoutCount = DB.getTryouts().filter(t => t.recipeId === r.id).length +
                        DB.getBreadTryouts().filter(t => t.recipeId === r.id).length;

    App.openModal(`
      <div class="modal-head">
        <h3>${r.name}</h3>
        <button class="modal-close" id="mClose">✕</button>
      </div>
      <div class="row" style="margin-bottom:10px;">
        <span class="badge">${RECIPE_CATEGORIES[r.category] || 'Otro'}</span>
        ${r.isBread ? '<span class="badge terracotta">🍞 Pan</span>' : ''}
        <span class="badge ochre">${tryoutCount} prueba${tryoutCount===1?'':'s'}</span>
      </div>
      ${missing.length ? `<p class="hint" style="color:var(--danger)">Algunos ingredientes de esta receta ya no existen en el catálogo.</p>` : ''}

      <h4>Ingredientes (para ${r.servings} porciones)</h4>
      <table class="mini-table">
        <thead><tr><th>Ingrediente</th><th class="num">Cantidad</th><th class="num">Costo</th></tr></thead>
        <tbody>
          ${(r.ingredients||[]).map(item => {
            const ing = byId.get(item.ingredientId);
            const unit = ing ? (ing.baseUnit === 'unidad' ? '' : ing.baseUnit) : '';
            const cost = ing ? Nutrition.costPerBaseUnit(ing) * item.amount : 0;
            return `<tr><td>${ing ? ing.name : '(eliminado)'}${item.brand ? ` <span class="muted">· ${item.brand}</span>` : ''}</td>
              <td class="num">${item.amount} ${unit}</td><td class="num">${Nutrition.fmtGs(cost)}</td></tr>`;
          }).join('')}
        </tbody>
      </table>

      <div class="stat-row" style="justify-content:space-between;">
        <div class="stat"><div class="num mono">${Nutrition.fmtNum(per.kcal,0)}</div><div class="lbl">kcal/porción</div></div>
        <div class="stat"><div class="num mono">${Nutrition.fmtNum(per.protein)}g</div><div class="lbl">proteína</div></div>
        <div class="stat"><div class="num mono">${Nutrition.fmtNum(per.carbs)}g</div><div class="lbl">carbs</div></div>
        <div class="stat"><div class="num mono">${Nutrition.fmtNum(per.fat)}g</div><div class="lbl">grasa</div></div>
        <div class="stat"><div class="num mono">${Nutrition.fmtNum(per.fiber)}g</div><div class="lbl">fibra</div></div>
      </div>
      <p class="muted" style="margin-top:6px;">Total receta: ${Nutrition.fmtGs(totals.cost)} · ${Nutrition.fmtNum(totals.kcal,0)} kcal</p>
      <p class="mono" style="font-size:1.1rem; margin-top:4px;">${Nutrition.fmtGs(per.cost)} <span class="muted mono" style="font-size:0.8rem;">por porción</span></p>

      ${r.steps && r.steps.length ? `<h4 style="margin-top:14px;">Procedimiento</h4>
      <ol style="padding-left:20px; font-size:0.9rem;">${r.steps.map(s => `<li style="margin-bottom:6px;">${s}</li>`).join('')}</ol>` : ''}
      ${r.notes ? `<h4 style="margin-top:14px;">Notas</h4><p style="font-size:0.9rem;">${r.notes}</p>` : ''}

      <div class="row" style="margin-top:16px;">
        <button class="btn block" id="btnStartTryout">Iniciar prueba con esta receta</button>
      </div>
      <div class="row" style="margin-top:8px;">
        <button class="btn secondary" id="btnEditRecipe" style="flex:1;">Editar</button>
        <button class="btn danger" id="btnDelRecipe" style="flex:1;">Eliminar</button>
      </div>
    `);

    document.getElementById('mClose').onclick = () => App.closeModal();
    document.getElementById('btnEditRecipe').onclick = () => Recipes.openForm(r.id);
    document.getElementById('btnDelRecipe').onclick = () => {
      if (confirm(`¿Eliminar la receta "${r.name}"? Las pruebas relacionadas quedarán sin receta asociada.`)) {
        DB.deleteRecipe(r.id);
        App.closeModal();
        Recipes.render();
        App.toast('Receta eliminada');
      }
    };
    document.getElementById('btnStartTryout').onclick = () => {
      App.closeModal();
      if (r.isBread) Bread.openTryoutForm(null, r.id);
      else Tryouts.openForm(null, r.id);
    };
  },

  openForm(id) {
    const r = id ? DB.getRecipes().find(x => x.id === id) : null;
    const isEdit = !!r;
    const catalog = DB.getIngredients().sort((a,b) => a.name.localeCompare(b.name,'es'));
    const ingredientItems = r ? r.ingredients : [];

    const ingOptionsHtml = catalog.map(i => `<option value="${i.id}">${i.name}</option>`).join('');

    App.openModal(`
      <div class="modal-head">
        <h3>${isEdit ? 'Editar receta' : 'Nueva receta'}</h3>
        <button class="modal-close" id="mClose">✕</button>
      </div>
      <form id="recForm">
        <div class="field"><label>Nombre</label><input name="name" required value="${r?.name || ''}"></div>
        <div class="field-inline">
          <div class="field"><label>Categoría</label>
            <select name="category">${Object.entries(RECIPE_CATEGORIES).map(([k,v]) => `<option value="${k}" ${r?.category===k?'selected':''}>${v}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Porciones</label><input type="number" name="servings" min="1" value="${r?.servings || 8}" required></div>
        </div>
        <div class="field">
          <label><input type="checkbox" name="isBread" ${r?.isBread?'checked':''} style="width:auto; margin-right:6px;">Es una receta de pan (aparece en la pestaña Pan)</label>
        </div>

        <h4>Ingredientes</h4>
        <div id="ingRows"></div>
        <button type="button" class="btn ghost small" id="btnAddIngRow" style="margin-bottom:10px;">+ Agregar ingrediente</button>

        <div class="field"><label>Procedimiento (un paso por línea)</label>
          <textarea name="steps" placeholder="Mezclar los secos...&#10;Agregar los líquidos...&#10;Hornear a 180°C por 40 min">${(r?.steps||[]).join('\n')}</textarea>
        </div>
        <div class="field"><label>Notas</label><textarea name="notes">${r?.notes || ''}</textarea></div>

        <button type="submit" class="btn block">${isEdit ? 'Guardar cambios' : 'Crear receta'}</button>
      </form>
    `);

    document.getElementById('mClose').onclick = () => App.closeModal();
    const rowsEl = document.getElementById('ingRows');

    function addRow(item) {
      const rowId = DB.uid();
      const div = document.createElement('div');
      div.className = 'ing-row';
      div.dataset.rowId = rowId;
      div.innerHTML = `
        <select class="ing-select">${catalog.length ? ingOptionsHtml : '<option value="">(sin ingredientes en catálogo)</option>'}</select>
        <input type="number" step="0.1" class="ing-amount" placeholder="cantidad" value="${item?.amount ?? ''}">
        <input type="text" class="ing-brand" placeholder="marca (opc.)" value="${item?.brand ?? ''}">
        <button type="button" class="ing-remove">✕</button>
      `;
      rowsEl.appendChild(div);
      if (item) div.querySelector('.ing-select').value = item.ingredientId;
      div.querySelector('.ing-remove').onclick = () => div.remove();
    }

    if (ingredientItems.length) ingredientItems.forEach(addRow);
    else addRow();

    document.getElementById('btnAddIngRow').onclick = () => addRow();

    document.getElementById('recForm').onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const ingredients = Array.from(rowsEl.querySelectorAll('.ing-row')).map(row => {
        const ingredientId = row.querySelector('.ing-select').value;
        const amount = parseFloat(row.querySelector('.ing-amount').value) || 0;
        const brand = row.querySelector('.ing-brand').value.trim();
        return ingredientId ? { ingredientId, amount, brand } : null;
      }).filter(Boolean);

      const record = {
        id: r?.id || DB.uid(),
        name: fd.get('name').trim(),
        category: fd.get('category'),
        servings: parseInt(fd.get('servings')) || 1,
        isBread: fd.get('isBread') === 'on',
        ingredients,
        steps: fd.get('steps').split('\n').map(s => s.trim()).filter(Boolean),
        notes: fd.get('notes').trim()
      };
      DB.upsertRecipe(record);
      App.closeModal();
      Recipes.render();
      App.toast(isEdit ? 'Receta actualizada' : 'Receta creada');
    };
  }
};

window.Recipes = Recipes;
