// bread.js — pestaña Pan: fichas de horneado, hidratación, comparación

const ADJUST_CHIPS = [
  'Más hidratación', 'Menos hidratación', 'Más leudado', 'Menos leudado',
  'Más goma xántica', 'Más horno', 'Menos horno', 'Amasar/batir más',
  'Cambiar harina', 'Más sal', 'Menos sal', 'Precalentar más el molde'
];

const Bread = {
  compareSelection: new Set(),

  render() {
    const el = document.getElementById('view-pan');
    const recipes = DB.getRecipes().filter(r => r.isBread).sort((a,b) => a.name.localeCompare(b.name,'es'));
    const catalog = DB.getIngredients();

    el.innerHTML = `
      <div class="section-head">
        <h2>🍞 Pan</h2>
        <button class="btn small" id="btnNewBreadRecipe">+ Receta de pan</button>
      </div>
      <p class="muted" style="margin-bottom:12px;">Cada intento queda registrado como una ficha, con la hidratación calculada según la categoría de tus ingredientes.</p>
      <div id="breadRecipeList"></div>
    `;

    const listEl = el.querySelector('#breadRecipeList');
    if (recipes.length === 0) {
      listEl.innerHTML = `<div class="empty"><div class="glyph">🍞</div><p>Todavía no hay recetas marcadas como pan.<br>Creá una receta y activá "Es una receta de pan".</p></div>`;
    } else {
      listEl.innerHTML = recipes.map(r => {
        const tryouts = DB.getBreadTryouts().filter(t => t.recipeId === r.id);
        const last = tryouts.slice().sort((a,b) => (b.date||'').localeCompare(a.date||''))[0];
        const { totals } = Nutrition.computeTotals(r.ingredients, catalog);
        const per = Nutrition.perServing(totals, r.servings);
        return `
        <div class="card tap" data-id="${r.id}">
          <div class="row between">
            <div>
              <div class="card-title">${r.name}</div>
              <span class="badge ochre">${tryouts.length} prueba${tryouts.length===1?'':'s'}</span>
            </div>
            <div class="stat"><div class="num mono">${Nutrition.fmtGs(per.cost)}</div><div class="lbl">por porción</div></div>
          </div>
          ${last ? `<p class="muted" style="margin-top:6px;">Última prueba: ${last.date} · ${Tryouts.starsHtml(Math.round(((last.crumbRating||0)+(last.crustRating||0)+(last.riseRating||0)+(last.tasteRating||0))/4))}</p>` : ''}
        </div>`;
      }).join('');
    }

    el.querySelector('#btnNewBreadRecipe').onclick = () => {
      Recipes.openForm();
      // pre-check "es pan" after modal renders
      setTimeout(() => {
        const cb = document.querySelector('#recForm [name=isBread]');
        if (cb) cb.checked = true;
      }, 0);
    };
    listEl.querySelectorAll('.card').forEach(card => {
      card.onclick = () => Bread.openRecipeDetail(card.dataset.id);
    });
  },

  hydrationBar(effectiveIngredients, catalog) {
    const byId = new Map(catalog.map(i => [i.id, i]));
    let flour = 0, liquid = 0, other = 0;
    effectiveIngredients.forEach(item => {
      const ing = byId.get(item.ingredientId);
      if (!ing) return;
      const grams = ing.baseUnit === 'unidad' ? item.amount * 50 : item.amount; // aprox 50g por unidad (ej. huevo)
      if (ing.category === 'harina' || ing.category === 'almidon') flour += grams;
      else if (ing.category === 'liquido') liquid += grams;
      else other += grams;
    });
    const hydration = flour > 0 ? (liquid / flour) * 100 : 0;
    const total = flour + liquid + other || 1;
    const html = `
      <div class="baker-bar">
        <span style="width:${(flour/total)*100}%; background:var(--ochre);"></span>
        <span style="width:${(liquid/total)*100}%; background:#7C93A8;"></span>
        <span style="width:${(other/total)*100}%; background:var(--olive);"></span>
      </div>
      <div class="baker-legend">
        <span><span class="dot" style="background:var(--ochre);"></span>Harinas/almidones ${Nutrition.fmtNum(flour,0)}g</span>
        <span><span class="dot" style="background:#7C93A8;"></span>Líquidos ${Nutrition.fmtNum(liquid,0)}g</span>
        <span><span class="dot" style="background:var(--olive);"></span>Otros ${Nutrition.fmtNum(other,0)}g</span>
      </div>
      <p class="mono" style="font-size:1.3rem;">${Nutrition.fmtNum(hydration,0)}% <span class="muted" style="font-size:0.75rem; font-family:var(--font-body);">hidratación (líquido/harina)</span></p>
    `;
    return { html, hydration };
  },

  openRecipeDetail(recipeId) {
    const r = DB.getRecipes().find(x => x.id === recipeId);
    if (!r) return;
    const catalog = DB.getIngredients();
    const tryouts = DB.getBreadTryouts().filter(t => t.recipeId === recipeId).sort((a,b) => (b.date||'').localeCompare(a.date||''));
    Bread.compareSelection.clear();

    App.openModal(`
      <div class="modal-head">
        <h3>${r.name}</h3>
        <button class="modal-close" id="mClose">✕</button>
      </div>
      <div class="row" style="margin-bottom:10px;">
        <button class="btn small" id="btnEditRecipe">Editar receta</button>
        <button class="btn small olive" id="btnNewBake">+ Nueva prueba</button>
      </div>
      <h4>Historial de pruebas</h4>
      <div id="bakeHistory"></div>
    `);

    const histEl = document.getElementById('bakeHistory');
    if (tryouts.length === 0) {
      histEl.innerHTML = `<div class="empty"><div class="glyph">📝</div><p>Todavía no registraste ninguna prueba de esta receta.</p></div>`;
    } else {
      histEl.innerHTML = tryouts.map(t => Bread.bakeCardHtml(t, r, catalog, true)).join('');
    }

    document.getElementById('mClose').onclick = () => App.closeModal();
    document.getElementById('btnEditRecipe').onclick = () => Recipes.openForm(r.id);
    document.getElementById('btnNewBake').onclick = () => Bread.openTryoutForm(null, r.id);

    histEl.querySelectorAll('.bake-card').forEach(card => {
      card.querySelector('.bake-select')?.addEventListener('change', (e) => {
        const id = card.dataset.id;
        if (e.target.checked) Bread.compareSelection.add(id); else Bread.compareSelection.delete(id);
      });
      card.querySelector('.bake-edit')?.addEventListener('click', () => Bread.openTryoutForm(card.dataset.id, r.id));
      card.querySelector('.bake-delete')?.addEventListener('click', () => {
        if (confirm('¿Eliminar esta prueba de pan?')) {
          DB.deleteBreadTryout(card.dataset.id);
          Bread.openRecipeDetail(r.id);
          App.toast('Prueba eliminada');
        }
      });
    });

    // inject compare button after history if 2+ tryouts
    if (tryouts.length >= 2) {
      const btn = document.createElement('button');
      btn.className = 'btn secondary block';
      btn.style.marginTop = '10px';
      btn.textContent = 'Comparar pruebas seleccionadas';
      btn.onclick = () => {
        if (Bread.compareSelection.size < 2) { App.toast('Elegí al menos 2 pruebas para comparar'); return; }
        Bread.openComparison(Array.from(Bread.compareSelection), r, catalog);
      };
      histEl.after(btn);
    }
  },

  bakeCardHtml(t, recipe, catalog, selectable) {
    const overall = Math.round(((t.crumbRating||0)+(t.crustRating||0)+(t.riseRating||0)+(t.tasteRating||0))/4);
    const effective = Nutrition.buildEffectiveIngredients(recipe, t);
    const { hydration } = Bread.hydrationBar(effective, catalog);
    return `
    <div class="bake-card" data-id="${t.id}">
      <div class="row between">
        <span class="bake-date">${t.date}</span>
        ${selectable ? `<label style="font-size:0.75rem; display:flex; align-items:center; gap:4px;"><input type="checkbox" class="bake-select" style="width:auto;"> comparar</label>` : ''}
      </div>
      <div class="row between" style="margin-top:4px;">
        <span class="mono" style="font-size:1rem;">${Nutrition.fmtNum(hydration,0)}% hidratación</span>
        <span class="stars">${Tryouts.starsHtml(overall)}</span>
      </div>
      <div class="rating-grid">
        <div class="stat"><span class="lbl">Miga</span> ${Tryouts.starsHtml(t.crumbRating)}</div>
        <div class="stat"><span class="lbl">Corteza</span> ${Tryouts.starsHtml(t.crustRating)}</div>
        <div class="stat"><span class="lbl">Volumen</span> ${Tryouts.starsHtml(t.riseRating)}</div>
        <div class="stat"><span class="lbl">Sabor</span> ${Tryouts.starsHtml(t.tasteRating)}</div>
      </div>
      <p class="muted" style="font-size:0.8rem;">Leudado: ${t.proofTime||'—'} min a ${t.proofTemp||'—'}°C · Horno: ${t.bakeTemp||'—'}°C por ${t.bakeTime||'—'} min</p>
      ${(t.quickTags||[]).length || t.nextAdjustments ? `<div class="adjust-note">
        ${(t.quickTags||[]).map(tag => `<span class="diff-tag change">${tag}</span>`).join('')}
        ${t.nextAdjustments ? `<p style="margin-top:4px;">${t.nextAdjustments}</p>` : ''}
      </div>` : ''}
      <div class="row" style="margin-top:10px;">
        <button class="btn ghost small bake-edit">Editar</button>
        <button class="btn danger small bake-delete">Eliminar</button>
      </div>
    </div>`;
  },

  openTryoutForm(tryoutId, recipeId) {
    const t = tryoutId ? DB.getBreadTryouts().find(x => x.id === tryoutId) : null;
    const isEdit = !!t;
    const r = DB.getRecipes().find(x => x.id === (t?.recipeId || recipeId));
    if (!r) { App.toast('Elegí primero una receta de pan'); return; }
    const catalog = DB.getIngredients().sort((a,b) => a.name.localeCompare(b.name,'es'));

    App.openModal(`
      <div class="modal-head">
        <h3>${isEdit ? 'Editar prueba' : 'Nueva prueba'} — ${r.name}</h3>
        <button class="modal-close" id="mClose">✕</button>
      </div>
      <form id="bForm">
        <div class="field"><label>Fecha</label><input type="date" name="date" value="${t?.date || new Date().toISOString().slice(0,10)}"></div>

        <h4>Cambios respecto a la receta original</h4>
        <div id="changeRows"></div>
        <h4 style="margin-top:12px;">Ingredientes extra</h4>
        <div id="extraRows"></div>
        <button type="button" class="btn ghost small" id="btnAddExtra" style="margin-bottom:10px;">+ Agregar ingrediente extra</button>

        <div id="hydrationPreview" style="margin:10px 0;"></div>

        <h4>Proceso</h4>
        <div class="field-inline">
          <div class="field"><label>Leudado (min)</label><input type="number" name="proofTime" value="${t?.proofTime ?? ''}"></div>
          <div class="field"><label>Temp. leudado (°C)</label><input type="number" name="proofTemp" value="${t?.proofTemp ?? ''}"></div>
        </div>
        <div class="field-inline">
          <div class="field"><label>Temp. horno (°C)</label><input type="number" name="bakeTemp" value="${t?.bakeTemp ?? ''}"></div>
          <div class="field"><label>Tiempo horno (min)</label><input type="number" name="bakeTime" value="${t?.bakeTime ?? ''}"></div>
        </div>
        <div class="field"><label>Método de mezcla / notas del proceso</label><textarea name="mixMethod">${t?.mixMethod || ''}</textarea></div>

        <h4>Resultado</h4>
        ${['crumbRating:Miga','crustRating:Corteza','riseRating:Volumen','tasteRating:Sabor'].map(pair => {
          const [key, label] = pair.split(':');
          return `<div class="field"><label>${label}</label><div class="stars rate-group" data-key="${key}">${[1,2,3,4,5].map(i => `<button type="button" data-v="${i}">★</button>`).join('')}</div><input type="hidden" name="${key}" value="${t?.[key]||0}"></div>`;
        }).join('')}

        <div class="field"><label>Ajustar la próxima vez</label>
          <div class="chip-select" id="adjustChips">${ADJUST_CHIPS.map(c => `<button type="button" class="chip ${(t?.quickTags||[]).includes(c)?'on':''}" data-tag="${c}">${c}</button>`).join('')}</div>
        </div>
        <div class="field"><label>Notas adicionales</label><textarea name="nextAdjustments" placeholder="ej. subir la miga estuvo densa cerca de la base, probar más leudado">${t?.nextAdjustments || ''}</textarea></div>

        <button type="submit" class="btn block">${isEdit ? 'Guardar cambios' : 'Guardar prueba'}</button>
      </form>
    `);

    document.getElementById('mClose').onclick = () => App.closeModal();

    const changeRowsEl = document.getElementById('changeRows');
    const extraRowsEl = document.getElementById('extraRows');
    const hydrationPreviewEl = document.getElementById('hydrationPreview');
    const byId = new Map(catalog.map(i => [i.id, i]));

    function refreshHydrationPreview() {
      const changes = Array.from(changeRowsEl.children).map(div => {
        const amt = div.querySelector('.chg-amount').value;
        const brand = div.querySelector('.chg-brand').value.trim();
        const removed = div.querySelector('.chg-removed').checked;
        return { ingredientId: div.dataset.ingredientId, newAmount: amt ? parseFloat(amt) : null, newBrand: brand || null, removed };
      });
      const extras = Array.from(extraRowsEl.children).map(div => {
        const ingredientId = div.querySelector('.extra-select').value;
        const amount = parseFloat(div.querySelector('.extra-amount').value) || 0;
        return { ingredientId, amount };
      }).filter(e => e.ingredientId && e.amount);
      const effective = Nutrition.buildEffectiveIngredients(r, { ingredientChanges: changes, extraIngredients: extras });
      hydrationPreviewEl.innerHTML = Bread.hydrationBar(effective, catalog).html;
    }

    (r.ingredients || []).forEach(item => {
      const existing = new Map((t?.ingredientChanges || []).map(c => [c.ingredientId, c]));
      const c = existing.get(item.ingredientId) || {};
      const ing = byId.get(item.ingredientId);
      const unit = ing ? (ing.baseUnit === 'unidad' ? '' : ing.baseUnit) : '';
      const div = document.createElement('div');
      div.className = 'card';
      div.style.padding = '10px';
      div.dataset.ingredientId = item.ingredientId;
      div.innerHTML = `
        <div class="row between"><strong style="font-size:0.88rem;">${ing ? ing.name : '?'}</strong>
          <label style="font-size:0.75rem; display:flex; align-items:center; gap:4px;"><input type="checkbox" class="chg-removed" style="width:auto;" ${c.removed?'checked':''}> Quitado</label>
        </div>
        <div class="field-inline" style="margin-top:6px;">
          <div class="field" style="margin-bottom:0;"><label>Cantidad (original: ${item.amount} ${unit})</label><input type="number" step="0.1" class="chg-amount" placeholder="${item.amount}" value="${c.newAmount ?? ''}"></div>
          <div class="field" style="margin-bottom:0;"><label>Marca (original: ${item.brand || '—'})</label><input type="text" class="chg-brand" placeholder="marca usada" value="${c.newBrand ?? ''}"></div>
        </div>
      `;
      changeRowsEl.appendChild(div);
      div.querySelectorAll('input').forEach(inp => inp.addEventListener('input', refreshHydrationPreview));
    });

    function addExtraRow(e) {
      const div = document.createElement('div');
      div.className = 'ing-row';
      div.innerHTML = `
        <div class="ing-row-top">
          <select class="extra-select">${catalog.map(i => `<option value="${i.id}">${i.name}</option>`).join('')}</select>
          <button type="button" class="ing-remove">✕</button>
        </div>
        <div class="ing-row-bottom">
          <div class="ing-amount-wrap">
            <input type="number" step="0.1" class="extra-amount" placeholder="cantidad" value="${e?.amount ?? ''}">
            <span class="ing-unit"></span>
          </div>
        </div>
      `;
      extraRowsEl.appendChild(div);
      const selectEl = div.querySelector('.extra-select');
      const unitEl = div.querySelector('.ing-unit');
      function updateUnit() {
        const ing = byId.get(selectEl.value);
        unitEl.textContent = ing ? (ing.baseUnit === 'unidad' ? 'unidad' : ing.baseUnit) : '';
      }
      if (e) selectEl.value = e.ingredientId;
      updateUnit();
      div.querySelector('.ing-remove').onclick = () => { div.remove(); refreshHydrationPreview(); };
      div.querySelectorAll('input, select').forEach(inp => inp.addEventListener('input', refreshHydrationPreview));
      selectEl.addEventListener('change', () => { updateUnit(); refreshHydrationPreview(); });
    }
    (t?.extraIngredients || []).forEach(addExtraRow);
    document.getElementById('btnAddExtra').onclick = () => { addExtraRow(); refreshHydrationPreview(); };
    refreshHydrationPreview();

    document.querySelectorAll('.rate-group').forEach(group => {
      const hidden = group.parentElement.querySelector('input[type=hidden]');
      let val = parseInt(hidden.value) || 0;
      function paint() { group.querySelectorAll('button').forEach(b => b.classList.toggle('on', parseInt(b.dataset.v) <= val)); }
      group.querySelectorAll('button').forEach(b => b.onclick = () => { val = parseInt(b.dataset.v); hidden.value = val; paint(); });
      paint();
    });

    document.getElementById('adjustChips').querySelectorAll('.chip').forEach(chip => {
      chip.onclick = () => chip.classList.toggle('on');
    });

    document.getElementById('bForm').onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const ingredientChanges = Array.from(changeRowsEl.children).map(div => {
        const amt = div.querySelector('.chg-amount').value;
        const brand = div.querySelector('.chg-brand').value.trim();
        const removed = div.querySelector('.chg-removed').checked;
        if (!amt && !brand && !removed) return null;
        return { ingredientId: div.dataset.ingredientId, newAmount: amt ? parseFloat(amt) : null, newBrand: brand || null, removed };
      }).filter(Boolean);
      const extraIngredients = Array.from(extraRowsEl.children).map(div => {
        const ingredientId = div.querySelector('.extra-select').value;
        const amount = parseFloat(div.querySelector('.extra-amount').value) || 0;
        return ingredientId && amount ? { ingredientId, amount } : null;
      }).filter(Boolean);
      const quickTags = Array.from(document.getElementById('adjustChips').querySelectorAll('.chip.on')).map(c => c.dataset.tag);

      const record = {
        id: t?.id || DB.uid(),
        recipeId: r.id,
        date: fd.get('date'),
        ingredientChanges,
        extraIngredients,
        proofTime: parseFloat(fd.get('proofTime')) || null,
        proofTemp: parseFloat(fd.get('proofTemp')) || null,
        bakeTemp: parseFloat(fd.get('bakeTemp')) || null,
        bakeTime: parseFloat(fd.get('bakeTime')) || null,
        mixMethod: fd.get('mixMethod').trim(),
        crumbRating: parseInt(fd.get('crumbRating')) || 0,
        crustRating: parseInt(fd.get('crustRating')) || 0,
        riseRating: parseInt(fd.get('riseRating')) || 0,
        tasteRating: parseInt(fd.get('tasteRating')) || 0,
        quickTags,
        nextAdjustments: fd.get('nextAdjustments').trim()
      };
      DB.upsertBreadTryout(record);
      App.closeModal();
      Bread.openRecipeDetail(r.id);
      Bread.render();
      App.toast(isEdit ? 'Prueba actualizada' : 'Prueba guardada');
    };
  },

  openComparison(ids, recipe, catalog) {
    const tryouts = ids.map(id => DB.getBreadTryouts().find(t => t.id === id)).filter(Boolean).sort((a,b) => (a.date||'').localeCompare(b.date||''));
    App.openModal(`
      <div class="modal-head">
        <h3>Comparar pruebas — ${recipe.name}</h3>
        <button class="modal-close" id="mClose">✕</button>
      </div>
      <div style="overflow-x:auto;">
        <table class="mini-table">
          <thead><tr><th></th>${tryouts.map(t => `<th>${t.date}</th>`).join('')}</tr></thead>
          <tbody>
            <tr><td>Hidratación</td>${tryouts.map(t => `<td class="num">${Nutrition.fmtNum(Bread.hydrationBar(Nutrition.buildEffectiveIngredients(recipe, t), catalog).hydration,0)}%</td>`).join('')}</tr>
            <tr><td>Leudado</td>${tryouts.map(t => `<td class="num">${t.proofTime||'—'}min / ${t.proofTemp||'—'}°C</td>`).join('')}</tr>
            <tr><td>Horno</td>${tryouts.map(t => `<td class="num">${t.bakeTemp||'—'}°C / ${t.bakeTime||'—'}min</td>`).join('')}</tr>
            <tr><td>Miga</td>${tryouts.map(t => `<td class="num">${'★'.repeat(t.crumbRating||0)}</td>`).join('')}</tr>
            <tr><td>Corteza</td>${tryouts.map(t => `<td class="num">${'★'.repeat(t.crustRating||0)}</td>`).join('')}</tr>
            <tr><td>Volumen</td>${tryouts.map(t => `<td class="num">${'★'.repeat(t.riseRating||0)}</td>`).join('')}</tr>
            <tr><td>Sabor</td>${tryouts.map(t => `<td class="num">${'★'.repeat(t.tasteRating||0)}</td>`).join('')}</tr>
          </tbody>
        </table>
      </div>
      <h4 style="margin-top:14px;">Ajustes anotados</h4>
      ${tryouts.map(t => `<p style="font-size:0.85rem;"><strong>${t.date}:</strong> ${(t.quickTags||[]).join(', ')}${t.nextAdjustments ? ' — ' + t.nextAdjustments : ''}</p>`).join('')}
    `);
    document.getElementById('mClose').onclick = () => App.closeModal();
  }
};

window.Bread = Bread;
