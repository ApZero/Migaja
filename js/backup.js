// backup.js — respaldo diario automático + exportar/importar manual

const MAX_DAILY_BACKUPS = 14;

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

const Backup = {
  // Se llama una vez al iniciar la app. Si hoy todavía no se generó
  // un respaldo automático, crea uno nuevo y descarta los más viejos.
  runDailyBackupIfNeeded() {
    const meta = DB.getMeta();
    const today = todayStr();
    if (meta.lastBackupDate === today) return { created: false };

    const snapshot = DB.exportAll();
    const backups = DB.getBackups();
    backups.push({ id: DB.uid(), date: today, createdAt: new Date().toISOString(), snapshot });
    while (backups.length > MAX_DAILY_BACKUPS) backups.shift();
    DB.saveBackups(backups);

    meta.lastBackupDate = today;
    DB.setMeta(meta);
    return { created: true, date: today };
  },

  listBackups() {
    return DB.getBackups().slice().sort((a, b) => b.date.localeCompare(a.date));
  },

  restoreBackup(backupId, { merge = false } = {}) {
    const b = DB.getBackups().find(x => x.id === backupId);
    if (!b) throw new Error('Respaldo no encontrado');
    DB.importAll(b.snapshot, { merge });
  },

  downloadSnapshot(snapshot, filenamePrefix = 'migaja-backup') {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  downloadNow() {
    Backup.downloadSnapshot(DB.exportAll(), 'migaja-backup');
  },

  async importFromFile(file, opts) {
    const text = await file.text();
    const payload = JSON.parse(text);
    DB.importAll(payload, opts);
  }
};

window.Backup = Backup;
