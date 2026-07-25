// tryouts.js — pruebas (variaciones) sobre recetas no-pan

const Tryouts = {
  render() {
    const el = document.getElementById('view-pruebas');
    const recipes = DB.getRecipes().filter(r => !r.isBread);
    const all = DB.getTryouts().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const recipeById = new Map(DB.getRecipes().map(r => [r.id, r]));

    el.innerHTML = `
      <div class="section-head">
        <h2>Pruebas</h2>
        <button class="btn small" id="btnNewTryout" ${recipes.length ? '' : 'disabled'}>+ Prueba</button>
      </div>
      <p class="muted" style="margin-bottom:12px;">Registrá qué cambiaste al preparar una receta — marca, cantidad, algo agregado o quitado — y cómo salió.</p>
      <div id="tryoutList"></div>
    `;

    const listEl = el.querySelector('#tryoutList');
    if (all.length === 0) {
      listEl.innerHTML = `<div class="empty"><div class="glyph">🧪</div><p>${recipes.length ? 'Todavía no registraste ninguna prueba.' : 'Primero creá una receta (que no sea de pan) para poder registrar pruebas.'}</p></div>`;
    } else {
      listEl.innerHTML = all.map(t => {
        const r = recipeById.get(t.recipeId);
        return `
        <div class="card tap" data-id="${t.id}">
          <div class="row between">
            <div>
              <div class="card-title">${r ? r.name : '(receta eliminada)'}</div>
              <span class="bake-date">${t.date}</span>
            </div>
            <div class="stars" data-static="true">${Tryouts.starsHtml(t.rating)}</div>
          </div>
          <div style="margin-top:8px;">${Tryouts.diffTagsHtml(t)}</div>
        </div>`;
      }).join('');
    }

    el.querySelector('#btnNewTryout').onclick = () => Tryouts.openForm();
    listEl.querySelectorAll('.card').forEach(card => {
      card.onclick = () => Tryouts.openDetail(card.dataset.id);
    });
  },

  starsHtml(rating) {
    let out = '';
    for (let i = 1; i <= 5; i++) out += `<span style="color:${i <= (rating||0) ? 'var(--ochre)' : 'var(--line)'}">★</span>`;
    return out;
  },

  diffTagsHtml(t) {
    const catalog = DB.getIngredients();
    const byId = new Map(catalog.map(i => [i.id, i]));
    const tags = [];
    (t.ingredientChanges || []).forEach(c => {
      const ing = byId.get(c.ingredientId);
      const name = ing ? ing.name : '?';
      if (c.removed) tags.push(`<span class="diff-tag remove">− ${name}</span>`);
      else {
        if (c.newAmount != null && c.newAmount !== '') tags.push(`<span class="diff-tag change">${name}: cantidad → ${c.newAmount}</span>`);
        if (c.newBrand) tags.push(`<span class="diff-tag change">${name}: marca → ${c.newBrand}</span>`);
      }
    });
    (t.extraIngredients || []).forEach(e => {
      const ing = byId.get(e.ingredientId);
      tags.push(`<span class="diff-tag add">+ ${ing ? ing.name : '?'} (${e.amount})</span>`);
    });
    if (!tags.length) tags.push(`<span class="muted">Sin cambios respecto a la receta original</span>`);
    return tags.join('');
  },

  openDetail(id) {
    const t = DB.getTryouts().find(x => x.id === id);
    if (!t) return;
    const r = DB.getRecipes().find(x => x.id === t.recipeId);
    App.openModal(`
      <div class="modal-head">
        <h3>${r ? r.name : '(receta eliminada)'}</h3>
        <button class="modal-close" id="mClose">✕</button>
      </div>
      <p class="bake-date">${t.date}</p>
      <div class="stars" style="margin:8px 0;">${Tryouts.starsHtml(t.rating)}</div>
      <div style="margin-bottom:10px;">${Tryouts.diffTagsHtml(t)}</div>
      ${t.notes ? `<p style="font-size:0.9rem;">${t.notes}</p>` : ''}
      <div class="row" style="margin-top:16px;">
        <button class="btn secondary" id="btnEditT" style="flex:1;">Editar</button>
        <button class="btn danger" id="btnDelT" style="flex:1;">Eliminar</button>
      </div>
    `);
    document.getElementById('mClose').onclick = () => App.closeModal();
    document.getElementById('btnEditT').onclick = () => Tryouts.openForm(t.id);
    document.getElementById('btnDelT').onclick = () => {
      if (confirm('¿Eliminar esta prueba?')) {
        DB.deleteTryout(t.id);
        App.closeModal();
        Tryouts.render();
        App.toast('Prueba eliminada');
      }
    };
  },

  openForm(tryoutId, presetRecipeId) {
    const t = tryoutId ? DB.getTryouts().find(x => x.id === tryoutId) : null;
    const isEdit = !!t;
    const recipes = DB.getRecipes().filter(r => !r.isBread);
    const initialRecipeId = t?.recipeId || presetRecipeId || (recipes[0] && recipes[0].id);
    const catalog = DB.getIngredients().sort((a,b) => a.name.localeCompare(b.name,'es'));

    App.openModal(`
      <div class="modal-head">
        <h3>${isEdit ? 'Editar prueba' : 'Nueva prueba'}</h3>
        <button class="modal-close" id="mClose">✕</button>
      </div>
      <form id="tForm">
        <div class="field"><label>Receta</label>
          <select name="recipeId" id="tRecipeSel">${recipes.map(r => `<option value="${r.id}" ${initialRecipeId===r.id?'selected':''}>${r.name}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Fecha</label><input type="date" name="date" value="${t?.date || new Date().toISOString().slice(0,10)}"></div>

        <h4>Cambios respecto a la receta original</h4>
        <div id="changeRows"></div>

        <h4 style="margin-top:14px;">Ingredientes extra agregados</h4>
        <div id="extraRows"></div>
        <button type="button" class="btn ghost small" id="btnAddExtra" style="margin-bottom:10px;">+ Agregar ingrediente extra</button>

        <div class="field"><label>Resultado (calificación)</label>
          <div class="stars" id="ratingStars">${[1,2,3,4,5].map(i => `<button type="button" data-v="${i}">★</button>`).join('')}</div>
          <input type="hidden" name="rating" id="ratingInput" value="${t?.rating || 0}">
        </div>
        <div class="field"><label>Notas</label><textarea name="notes" placeholder="¿Cómo salió? ¿Qué ajustarías?">${t?.notes || ''}</textarea></div>

        <button type="submit" class="btn block">${isEdit ? 'Guardar cambios' : 'Guardar prueba'}</button>
      </form>
    `);

    document.getElementById('mClose').onclick = () => App.closeModal();

    const changeRowsEl = document.getElementById('changeRows');
    const extraRowsEl = document.getElementById('extraRows');

    function renderChangeRows(recipeId) {
      const r = DB.getRecipes().find(x => x.id === recipeId);
      const byId = new Map(catalog.map(i => [i.id, i]));
      const existing = new Map((t?.ingredientChanges || []).map(c => [c.ingredientId, c]));
      changeRowsEl.innerHTML = '';
      (r?.ingredients || []).forEach(item => {
        const ing = byId.get(item.ingredientId);
        const c = existing.get(item.ingredientId) || {};
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
      });
    }

    function addExtraRow(e) {
      const div = document.createElement('div');
      div.className = 'ing-row';
      div.innerHTML = `
        <select class="extra-select">${catalog.map(i => `<option value="${i.id}">${i.name}</option>`).join('')}</select>
        <input type="number" step="0.1" class="extra-amount" placeholder="cantidad" value="${e?.amount ?? ''}">
        <button type="button" class="ing-remove">✕</button>
      `;
      extraRowsEl.appendChild(div);
      if (e) div.querySelector('.extra-select').value = e.ingredientId;
      div.querySelector('.ing-remove').onclick = () => div.remove();
    }

    renderChangeRows(initialRecipeId);
    (t?.extraIngredients || []).forEach(addExtraRow);
    document.getElementById('tRecipeSel').onchange = (e) => renderChangeRows(e.target.value);
    document.getElementById('btnAddExtra').onclick = () => addExtraRow();

    let currentRating = t?.rating || 0;
    const starsEl = document.getElementById('ratingStars');
    function paintStars() {
      starsEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', parseInt(b.dataset.v) <= currentRating));
    }
    starsEl.querySelectorAll('button').forEach(b => {
      b.onclick = () => { currentRating = parseInt(b.dataset.v); document.getElementById('ratingInput').value = currentRating; paintStars(); };
    });
    paintStars();

    document.getElementById('tForm').onsubmit = (e) => {
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

      const record = {
        id: t?.id || DB.uid(),
        recipeId: fd.get('recipeId'),
        date: fd.get('date'),
        ingredientChanges,
        extraIngredients,
        rating: currentRating,
        notes: fd.get('notes').trim()
      };
      DB.upsertTryout(record);
      App.closeModal();
      Tryouts.render();
      App.toast(isEdit ? 'Prueba actualizada' : 'Prueba guardada');
    };
  }
};

window.Tryouts = Tryouts;
