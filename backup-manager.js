// =================================================================
// BACKUP-MANAGER.JS - VERSIÓN SUPABASE
// Los datos se respaldan automáticamente en Supabase.
// Este módulo mantiene compatibilidad con las llamadas existentes
// en api.js y app.js, pero ya no gestiona archivos locales.
// =================================================================

const backupManager = {

    // No-op: Supabase ya es el backup
    async initialize() {
        console.log("Backup: Supabase activo — respaldo automático en la nube.");
        ui.showBackupFolderPath();
    },

    // No-op: se llama desde api.js en cada cambio, no hace nada
    async createBackup() {
        // Los datos ya están en Supabase — no se necesita backup adicional
    },

    // Limpiar caché local (localStorage)
    async clearLocalCache() {
        if (!confirm("¿Borrar el caché local? Tus vuelos siguen en la nube y se recargarán al iniciar sesión.")) return;
        localStorage.removeItem('flightLogData');
        flightData = [];
        ui.showNotification("Caché local borrado. Recargando...", "success");
        setTimeout(() => location.reload(), 1500);
    },

    // Stubs para compatibilidad con código existente
    async setupBackupFolder() {
        ui.showNotification("El respaldo automático está activo en la nube. No se requiere configurar carpeta.", "info");
    },

    async restoreFromBackup() {
        ui.showNotification("Para restaurar, importa un archivo Excel desde 'Importar Excel'.", "info");
    },

    closeRestoreModal() {
        const modal = document.getElementById('restore-modal');
        if (modal) modal.classList.remove('open');
    },

    async verifyPermission() { return true; },
    async cleanupOldBackups() {},
    showBackupListModal() {},
    async loadBackupFile() {},
    getLocalTimestamp() { return new Date().toISOString(); },
    formatDateFromName(name) { return name; },
};