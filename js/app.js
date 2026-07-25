// app.js — controlador principal: pestañas, modal, respaldo diario, inicio

const App = {
  currentTab: 'hoy',

  init() {
    DB.seedIfEmpty();
    const result = Backup.runDailyBackupIfNeeded();
    if (result.created) App.toastQueued = 'Respaldo automático del día creado';

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => App.showTab(btn.dataset.tab);
    });
    document.getElementById('overlay').addEventListener('click', (e) => {
      if (e.target.id === 'overlay') App.closeModal();
    });

    App.showTab('hoy');
    App.updateBackupIndicator();
    if (App.toastQueued) { App.toast(App.toastQueued); App.toastQueued = null; }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW registration failed', err));
    }
  },

  showTab(tab) {
    App.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${tab}`));
    switch (tab) {
      case 'hoy': App.renderHoy(); break;
      case 'ingredientes': Ingredients.render(); break;
      case 'recetas': Recipes.render(); break;
      case 'pruebas': Tryouts.render(); break;
      case 'pan': Bread.render(); break;
      case 'respaldo': App.renderRespaldo(); break;
    }
  },

  renderHoy() {
    const el = document.getElementById('view-hoy');
    const recipes = DB.getRecipes();
    const ingredients = DB.getIngredients();
    const tryouts = DB.getTryouts();
    const breadTryouts = DB.getBreadTryouts();
    const allBread = breadTryouts.slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const lastBread = allBread[0];
    const lastBreadRecipe = lastBread ? recipes.find(r => r.id === lastBread.recipeId) : null;
    const meta = DB.getMeta();

    el.innerHTML = `
      <div class="section-head"><h2>Hoy</h2></div>
      <div class="card">
        <div class="stat-row" style="border:none; padding-top:0; justify-content:space-between;">
          <div class="stat"><div class="num mono">${recipes.length}</div><div class="lbl">Recetas</div></div>
          <div class="stat"><div class="num mono">${ingredients.length}</div><div class="lbl">Ingredientes</div></div>
          <div class="stat"><div class="num mono">${tryouts.length + breadTryouts.length}</div><div class="lbl">Pruebas</div></div>
          <div class="stat"><div class="num mono">${recipes.filter(r=>r.isBread).length}</div><div class="lbl">Panes</div></div>
        </div>
      </div>
      ${lastBread ? `
      <div class="card">
        <p class="muted" style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.4px;">Última prueba de pan</p>
        <div class="card-title">${lastBreadRecipe ? lastBreadRecipe.name : '(receta eliminada)'}</div>
        <p class="muted">${lastBread.date}</p>
        <div class="rating-grid">
          <div class="stat"><span class="lbl">Miga</span> ${Tryouts.starsHtml(lastBread.crumbRating)}</div>
          <div class="stat"><span class="lbl">Corteza</span> ${Tryouts.starsHtml(lastBread.crustRating)}</div>
        </div>
      </div>` : `
      <div class="card">
        <p class="muted">Todavía no registraste ninguna prueba de pan. La pestaña <strong>Pan</strong> te espera 🍞</p>
      </div>`}
      <div class="card">
        <div class="row between">
          <div>
            <p class="muted" style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.4px;">Respaldo</p>
            <p>${meta.lastBackupDate === new Date().toISOString().slice(0,10) ? 'Al día — respaldo automático de hoy listo' : 'Todavía no se generó el respaldo de hoy'}</p>
          </div>
          <button class="btn small secondary" id="btnGoBackup">Ver</button>
        </div>
      </div>
    `;
    el.querySelector('#btnGoBackup').onclick = () => App.showTab('respaldo');
  },

  renderRespaldo() {
    const el = document.getElementById('view-respaldo');
    const backups = Backup.listBackups();
    const meta = DB.getMeta();

    el.innerHTML = `
      <div class="section-head"><h2>Respaldo</h2></div>
      <div class="card">
        <p style="font-size:0.9rem;">Cada día que abrís la app se guarda automáticamente una copia de tus datos (hasta 14 días). También podés descargar o importar un respaldo manualmente.</p>
        <p class="muted" style="margin-top:8px;">Último respaldo automático: <strong>${meta.lastBackupDate || 'ninguno todavía'}</strong></p>
      </div>
      <div class="card">
        <h4>Respaldo manual</h4>
        <div class="row" style="margin-top:8px;">
          <button class="btn" id="btnDownloadNow">Descargar respaldo ahora</button>
        </div>
        <div class="field" style="margin-top:14px;">
          <label>Importar desde un archivo</label>
          <input type="file" id="fileImport" accept="application/json">
        </div>
        <div class="row">
          <label style="font-size:0.8rem; display:flex; align-items:center; gap:6px;"><input type="checkbox" id="mergeCheck" style="width:auto;" checked> Combinar con datos actuales (en vez de reemplazar todo)</label>
        </div>
        <button class="btn secondary block" id="btnImportFile" style="margin-top:8px;">Importar archivo</button>
      </div>
      <h4 style="margin:14px 0 8px;">Respaldos automáticos guardados</h4>
      <div id="backupList"></div>
    `;

    const listEl = el.querySelector('#backupList');
    if (backups.length === 0) {
      listEl.innerHTML = `<p class="muted">Todavía no hay respaldos automáticos guardados.</p>`;
    } else {
      listEl.innerHTML = backups.map(b => `
        <div class="card">
          <div class="row between">
            <div>
              <div class="card-title">${b.date}</div>
              <p class="muted" style="font-size:0.75rem;">${b.snapshot.data.recipes.length} recetas · ${b.snapshot.data.ingredients.length} ingredientes · ${b.snapshot.data.tryouts.length + b.snapshot.data.breadTryouts.length} pruebas</p>
            </div>
            <div class="row">
              <button class="btn small ghost" data-action="download" data-id="${b.id}">Descargar</button>
              <button class="btn small secondary" data-action="restore" data-id="${b.id}">Restaurar</button>
            </div>
          </div>
        </div>
      `).join('');
    }

    listEl.querySelectorAll('[data-action=download]').forEach(btn => {
      btn.onclick = () => {
        const b = DB.getBackups().find(x => x.id === btn.dataset.id);
        Backup.downloadSnapshot(b.snapshot, `migaja-respaldo-${b.date}`);
      };
    });
    listEl.querySelectorAll('[data-action=restore]').forEach(btn => {
      btn.onclick = () => {
        if (confirm('¿Restaurar este respaldo? Podés elegir combinar o reemplazar los datos actuales en el siguiente paso.')) {
          const merge = confirm('¿Combinar con los datos actuales? Cancelar = reemplazar todo.');
          Backup.restoreBackup(btn.dataset.id, { merge });
          App.toast('Respaldo restaurado');
          App.showTab('respaldo');
        }
      };
    });

    document.getElementById('btnDownloadNow').onclick = () => { Backup.downloadNow(); App.toast('Respaldo descargado'); };
    document.getElementById('btnImportFile').onclick = async () => {
      const fileInput = document.getElementById('fileImport');
      const file = fileInput.files[0];
      if (!file) { App.toast('Elegí un archivo primero'); return; }
      try {
        const merge = document.getElementById('mergeCheck').checked;
        await Backup.importFromFile(file, { merge });
        App.toast('Datos importados correctamente');
        App.showTab('respaldo');
      } catch (e) {
        console.error(e);
        alert('No se pudo importar el archivo. Verificá que sea un respaldo válido de Migaja.');
      }
    };
  },

  updateBackupIndicator() {
    const meta = DB.getMeta();
    const el = document.getElementById('backupIndicator');
    const today = new Date().toISOString().slice(0,10);
    el.classList.toggle('stale', meta.lastBackupDate !== today);
    el.title = meta.lastBackupDate === today ? 'Respaldo de hoy listo' : 'Respaldo de hoy pendiente';
  },

  openModal(html) {
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('overlay').classList.add('open');
  },
  closeModal() {
    document.getElementById('overlay').classList.remove('open');
    document.getElementById('modalContent').innerHTML = '';
  },
  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(App._toastTimer);
    App._toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
};

document.addEventListener('DOMContentLoaded', App.init);
