// ingredients.js — catálogo de ingredientes (nutrición + precio)

const ING_CATEGORIES = {
  harina: 'Harina', almidon: 'Almidón', leudante: 'Leudante', grasa: 'Grasa/Aceite',
  liquido: 'Líquido', endulzante: 'Endulzante', aditivo: 'Aditivo/Goma', otro: 'Otro'
};

const Ingredients = {
  filterCategory: 'todas',

  render() {
    const el = document.getElementById('view-ingredientes');
    const list = DB.getIngredients().sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const filtered = Ingredients.filterCategory === 'todas' ? list : list.filter(i => i.category === Ingredients.filterCategory);

    el.innerHTML = `
      <div class="section-head">
        <h2>Ingredientes</h2>
        <button class="btn small" id="btnNewIng">+ Ingrediente</button>
      </div>
      <div class="chip-select" id="ingCatFilter" style="margin-bottom:12px;">
        <button class="chip ${Ingredients.filterCategory==='todas'?'on':''}" data-cat="todas">Todas</button>
        ${Object.entries(ING_CATEGORIES).map(([k,v]) => `<button class="chip ${Ingredients.filterCategory===k?'on':''}" data-cat="${k}">${v}</button>`).join('')}
      </div>
      <div id="ingList"></div>
    `;

    const listEl = el.querySelector('#ingList');
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty"><div class="glyph">🌾</div><p>Todavía no hay ingredientes en esta categoría.</p></div>`;
    } else {
      listEl.innerHTML = filtered.map(ing => {
        const cpu = Nutrition.costPerBaseUnit(ing);
        const unitLbl = ing.baseUnit === 'unidad' ? 'unidad' : ing.baseUnit;
        return `
        <div class="card tap" data-id="${ing.id}">
          <div class="row between">
            <div>
              <div class="card-title">${ing.name}</div>
              <span class="badge">${ING_CATEGORIES[ing.category] || 'Otro'}</span>
              ${ing.brand ? `<span class="badge terracotta">${ing.brand}</span>` : ''}
            </div>
            <div class="stat">
              <div class="num mono">${Nutrition.fmtGs(cpu)}</div>
              <div class="lbl">por ${unitLbl}</div>
            </div>
          </div>
        </div>`;
      }).join('');
    }

    el.querySelector('#btnNewIng').onclick = () => Ingredients.openForm();
    el.querySelectorAll('#ingCatFilter .chip').forEach(btn => {
      btn.onclick = () => { Ingredients.filterCategory = btn.dataset.cat; Ingredients.render(); };
    });
    listEl.querySelectorAll('.card').forEach(card => {
      card.onclick = () => Ingredients.openForm(card.dataset.id);
    });
  },

  openForm(id) {
    const ing = id ? DB.getIngredients().find(i => i.id === id) : null;
    const isEdit = !!ing;
    const n = ing ? ing.nutrition : {};
    const p = ing ? ing.purchase : {};

    App.openModal(`
      <div class="modal-head">
        <h3>${isEdit ? 'Editar ingrediente' : 'Nuevo ingrediente'}</h3>
        <button class="modal-close" id="mClose">✕</button>
      </div>
      <form id="ingForm">
        <div class="field"><label>Nombre</label><input name="name" required value="${ing?.name || ''}"></div>
        <div class="field-inline">
          <div class="field"><label>Categoría</label>
            <select name="category">${Object.entries(ING_CATEGORIES).map(([k,v]) => `<option value="${k}" ${ing?.category===k?'selected':''}>${v}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Marca (opcional)</label><input name="brand" value="${ing?.brand || ''}"></div>
        </div>
        <div class="field"><label>Unidad base</label>
          <select name="baseUnit">
            <option value="g" ${ing?.baseUnit==='g'?'selected':''}>Gramos (g)</option>
            <option value="ml" ${ing?.baseUnit==='ml'?'selected':''}>Mililitros (ml)</option>
            <option value="unidad" ${ing?.baseUnit==='unidad'?'selected':''}>Unidad (ej. huevo)</option>
          </select>
        </div>
        <h4 style="margin-top:14px;">Precio de compra</h4>
        <div class="field-inline">
          <div class="field"><label>Precio pagado (₲)</label><input type="number" name="price" step="1" value="${p?.price ?? ''}" required></div>
          <div class="field"><label id="sizeLbl">Cantidad del paquete</label><input type="number" name="size" step="0.01" value="${p?.size ?? ''}" required></div>
        </div>
        <p class="hint">Ej: pagaste ₲ 12.000 por un paquete de 1000 g → costo por g se calcula solo.</p>

        <h4 style="margin-top:14px;">Valor nutricional (por 100 g/ml, o por unidad si aplica)</h4>
        <div class="field-inline">
          <div class="field"><label>Kcal</label><input type="number" name="kcal" step="0.1" value="${n.kcal ?? ''}"></div>
          <div class="field"><label>Proteína (g)</label><input type="number" name="protein" step="0.1" value="${n.protein ?? ''}"></div>
        </div>
        <div class="field-inline">
          <div class="field"><label>Carbohidratos (g)</label><input type="number" name="carbs" step="0.1" value="${n.carbs ?? ''}"></div>
          <div class="field"><label>Grasas (g)</label><input type="number" name="fat" step="0.1" value="${n.fat ?? ''}"></div>
        </div>
        <div class="field-inline">
          <div class="field"><label>Fibra (g)</label><input type="number" name="fiber" step="0.1" value="${n.fiber ?? ''}"></div>
          <div class="field"><label>Sodio (mg)</label><input type="number" name="sodium" step="0.1" value="${n.sodium ?? ''}"></div>
        </div>

        <div class="row" style="margin-top:16px;">
          <button type="submit" class="btn block">${isEdit ? 'Guardar cambios' : 'Agregar ingrediente'}</button>
        </div>
        ${isEdit ? `<button type="button" class="btn danger block" id="btnDelIng" style="margin-top:8px;">Eliminar ingrediente</button>` : ''}
      </form>
    `);

    document.getElementById('mClose').onclick = () => App.closeModal();
    const form = document.getElementById('ingForm');
    const baseUnitSel = form.querySelector('[name=baseUnit]');
    const sizeLbl = document.getElementById('sizeLbl');
    const updateSizeLbl = () => {
      const u = baseUnitSel.value;
      sizeLbl.textContent = u === 'unidad' ? 'Cantidad de unidades' : `Cantidad (${u})`;
    };
    baseUnitSel.onchange = updateSizeLbl;
    updateSizeLbl();

    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const record = {
        id: ing?.id || DB.uid(),
        name: fd.get('name').trim(),
        category: fd.get('category'),
        brand: fd.get('brand').trim(),
        baseUnit: fd.get('baseUnit'),
        purchase: { price: parseFloat(fd.get('price')) || 0, size: parseFloat(fd.get('size')) || 1 },
        nutrition: {
          kcal: parseFloat(fd.get('kcal')) || 0,
          protein: parseFloat(fd.get('protein')) || 0,
          carbs: parseFloat(fd.get('carbs')) || 0,
          fat: parseFloat(fd.get('fat')) || 0,
          fiber: parseFloat(fd.get('fiber')) || 0,
          sodium: parseFloat(fd.get('sodium')) || 0
        },
        createdAt: ing?.createdAt || new Date().toISOString()
      };
      DB.upsertIngredient(record);
      App.closeModal();
      Ingredients.render();
      App.toast(isEdit ? 'Ingrediente actualizado' : 'Ingrediente agregado');
    };

    if (isEdit) {
      document.getElementById('btnDelIng').onclick = () => {
        if (confirm(`¿Eliminar "${ing.name}"? Esto no borra recetas que ya lo usan.`)) {
          DB.deleteIngredient(ing.id);
          App.closeModal();
          Ingredients.render();
          App.toast('Ingrediente eliminado');
        }
      };
    }
  }
};

window.Ingredients = Ingredients;
