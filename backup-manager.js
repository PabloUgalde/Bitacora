// --- MÓDULO DE GESTIÓN DE RESPALDOS AUTOMÁTICOS ---

const backupManager = {
    directoryHandle: null,
    DB_KEY: 'backupDirectoryHandle',

    async initialize() {
        if (!window.showDirectoryPicker || typeof idbKeyval === 'undefined') {
            console.warn("La API de Acceso al Sistema de Archivos o IndexedDB no son compatibles.");
            ui.showBackupFolderPath(true); // true indica que la función no es compatible
            return;
        }
        try {
            const handle = await idbKeyval.get(this.DB_KEY);
            if (handle) {
                if (await this.verifyPermission(handle)) {
                    this.directoryHandle = handle;
                    console.log("Manejador de carpeta de respaldo cargado y verificado.");
                    ui.showBackupFolderPath(); // Muestra la ruta guardada
                } else {
                    console.log("Permiso para la carpeta de respaldo guardada revocado. Limpiando handle.");
                    this.directoryHandle = null;
                    await idbKeyval.del(this.DB_KEY);
                    userProfile.backupFolderName = null;
                    await api.saveProfile(userProfile); // Guarda el perfil sin el nombre de la carpeta
                    ui.showBackupFolderPath();
                    ui.showNotification("Permiso de respaldo expirado. Por favor, reconfigure la carpeta.");
                }
            } else {
                ui.showBackupFolderPath(); // No hay carpeta configurada
            }
        } catch (error) {
            console.error("Error al inicializar el gestor de respaldos:", error);
            ui.showBackupFolderPath();
        }
    },

    getLocalTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hour}-${minute}-${second}`;
    },

    async setupBackupFolder() {
        try {
            const handle = await window.showDirectoryPicker();
            if (await this.verifyPermission(handle, 'readwrite')) {
                this.directoryHandle = handle;
                await idbKeyval.set(this.DB_KEY, handle);
                
                userProfile.backupFolderName = handle.name;
                await api.saveProfile(userProfile); 
                
                ui.showBackupFolderPath(); 
                
                alert(`¡Perfecto! La carpeta "${handle.name}" ha sido configurada y guardada.`);
            } else {
                alert("Se necesitan permisos de lectura y escritura para la carpeta seleccionada.");
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error("Error al configurar la carpeta:", error);
                ui.showNotification("Error: No se pudo configurar la carpeta.", "error");
            }
        }
    },

    async createBackup() {
        if (!this.directoryHandle) return;
        try {
            const timestamp = this.getLocalTimestamp();
            const fileName = `Bitacora_Respaldo_${timestamp}.json`;
            const backupData = { profile: userProfile, flights: flightData };
            const fileHandle = await this.directoryHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(backupData, null, 2));
            await writable.close();
            console.log(`Respaldo completo creado: ${fileName}`);
            await this.cleanupOldBackups();
        } catch (error) {
            console.error("Error al crear respaldo:", error);
            ui.showNotification("Error al crear respaldo automático.", "error");
        }
    },

    async cleanupOldBackups() {
        if (!this.directoryHandle || !userProfile.backupRetentionDays) return;
        const retentionDays = parseInt(userProfile.backupRetentionDays, 10);
        if (isNaN(retentionDays) || retentionDays === 0) {
            return;
        }
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - retentionDays);
        try {
            for await (const entry of this.directoryHandle.values()) {
                if (entry.kind === 'file' && entry.name.startsWith('Bitacora_Respaldo_')) {
                    const fileTimestampStr = entry.name.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
                    if (fileTimestampStr) {
                        const fileDate = new Date(fileTimestampStr[1].replace('T', ' '));
                        if (fileDate < limitDate) {
                            await this.directoryHandle.removeEntry(entry.name);
                            console.log(`Respaldo antiguo eliminado: ${entry.name}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error durante la limpieza de respaldos antiguos:", error);
        }
    },

    async restoreFromBackup() {
        try {
            const handle = await window.showDirectoryPicker();
            if (!(await this.verifyPermission(handle, 'read'))) {
                 alert("Se necesita permiso de lectura para la carpeta.");
                 return;
            }
            const backupFiles = [];
            for await (const entry of handle.values()) {
                if (entry.kind === 'file' && entry.name.startsWith('Bitacora_Respaldo_') && entry.name.endsWith('.json')) {
                    backupFiles.push(entry);
                }
            }
            if (backupFiles.length === 0) {
                alert("No se encontraron archivos de respaldo en la carpeta seleccionada.");
                return;
            }
            backupFiles.sort((a, b) => b.name.localeCompare(a.name));
            const latestBackup = backupFiles[0];
            const dateFromName = this.formatDateFromName(latestBackup.name);
            if (confirm(`Se encontró un respaldo del ${dateFromName}. ¿Restaurar esta versión (la más reciente)?\n\n(Si cancelas, podrás elegir de una lista).`)) {
                await this.loadBackupFile(latestBackup);
            } else {
                this.showBackupListModal(backupFiles);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error("Error al restaurar:", error);
                alert("Ocurrió un error durante la restauración.");
            }
        }
    },
    
    showBackupListModal(files) {
        const modal = document.getElementById('restore-modal');
        const container = document.getElementById('backup-list-container');
        container.innerHTML = '';
        const list = document.createElement('ul');
        list.className = 'backup-list';
        files.forEach(fileHandle => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<button class="backup-item-btn"><span class="backup-name">${this.formatDateFromName(fileHandle.name)}</span><span class="backup-action">Restaurar</span></button>`;
            listItem.querySelector('button').addEventListener('click', async () => {
                if (confirm(`¿Restaurar la versión del ${this.formatDateFromName(fileHandle.name)}? Se sobrescribirán tus datos locales.`)) {
                    await this.loadBackupFile(fileHandle);
                    this.closeRestoreModal();
                }
            });
            list.appendChild(listItem);
        });
        container.appendChild(list);
        modal.classList.add('open');
    },

    async loadBackupFile(fileHandle) {
        try {
            const file = await fileHandle.getFile();
            const content = await file.text();
            const restoredData = JSON.parse(content);
            if (restoredData && restoredData.profile && Array.isArray(restoredData.flights)) {
                userProfile = restoredData.profile;
                flightData = restoredData.flights.map(flight => {
                    flight.Fecha = new Date(flight.Fecha);
                    return flight;
                });
                await api.saveProfile(userProfile); 
                api.saveFlightsToLocalStorage();
                alert(`¡Restauración completada! Se cargaron el perfil y ${flightData.length} vuelos. La página se recargará.`);
                location.reload();
            } else if (Array.isArray(restoredData)) {
                flightData = restoredData.map(flight => { flight.Fecha = new Date(flight.Fecha); return flight; });
                api.saveFlightsToLocalStorage();
                await api.saveProfile(userProfile);
                alert(`Restauración completada desde respaldo antiguo. Se cargaron ${flightData.length} vuelos.`);
                location.reload();
            } else { throw new Error("Formato de archivo inválido."); }
        } catch (error) {
            console.error("Error al cargar archivo de respaldo:", error);
            alert("No se pudo leer o procesar el archivo de respaldo.");
        }
    },

    closeRestoreModal() {
        document.getElementById('restore-modal').classList.remove('open');
    },
    
    formatDateFromName(fileName) {
        try {
            const timestampMatch = fileName.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
            if (!timestampMatch) return fileName;
            const timestampStr = timestampMatch[1].replace('T', ' ');
            const date = new Date(timestampStr.replace(/-/g, '/')); // Reemplazar guiones por slashes para compatibilidad
            if (isNaN(date.getTime())) return fileName;
            return date.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            console.error("Error formateando fecha:", e);
            return fileName;
        }
    },
    
    async verifyPermission(handle, mode = 'readwrite') {
        try {
            if ((await handle.queryPermission({ mode })) === 'granted') return true;
            if ((await handle.requestPermission({ mode })) === 'granted') return true;
        } catch (error) {
            console.error("Error al verificar permisos:", error);
            return false;
        }
        return false;
    }
};