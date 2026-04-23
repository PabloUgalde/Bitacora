const miCuenta = {

    init: () => {
        const emailEl = document.getElementById('cuenta-email-display');
        if (emailEl && currentUser?.email) {
            emailEl.textContent = currentUser.email;
        }
    },

    sendPasswordReset: async () => {
        const btn = document.querySelector('#panel-cuenta button[onclick*="sendPasswordReset"]');
        const msg = document.getElementById('cuenta-password-msg');
        if (!currentUser?.email) return;

        if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

        const { error } = await supabaseClient.auth.resetPasswordForEmail(currentUser.email, {
            redirectTo: window.location.origin,
        });

        if (btn) { btn.disabled = false; btn.textContent = 'Cambiar contraseña'; }

        if (error) {
            if (msg) { msg.textContent = 'Error al enviar. Intenta de nuevo.'; msg.style.color = '#c05050'; }
        } else {
            if (msg) { msg.textContent = `Se envió un enlace a ${currentUser.email}.`; msg.style.color = '#4a9a4a'; }
            setTimeout(() => { if (msg) msg.textContent = ''; }, 5000);
        }
    },

    confirmDeleteAccount: async () => {
        // Mostrar un modal de confirmación robusto para evitar eliminaciones accidentales
        const modal = document.createElement('div');
        modal.className = 'modal open';
        modal.style.zIndex = "10002";
        modal.innerHTML = `
            <div class="modal-content" style="max-width:450px;">
                <div class="modal-header">
                    <h3>Eliminar Cuenta y Datos</h3>
                    <span class="close-button" onclick="this.closest('.modal').remove()">×</span>
                </div>
                <p style="color:var(--text-muted-color); margin-bottom:1.5rem;">
                    Esta acción eliminará **permanentemente** todos tus registros de vuelo y tu perfil de la base de datos.
                    <br><br>
                    Para confirmar, por favor escribe tu email:
                </p>
                <input type="email" id="confirm-delete-email" placeholder="tu@email.com" style="width:100%; margin-bottom:1rem;">
                <p id="delete-error-message" style="color:var(--accent-color-red); font-size:0.9rem; min-height:1.2em;"></p>
                <div style="display:flex; justify-content:flex-end; gap:12px; padding-top:1rem; border-top:1px solid var(--border-color);">
                    <button class="prev-btn" onclick="this.closest('.modal').remove()">Cancelar</button>
                    <button id="confirm-delete-btn" class="settings-btn-danger" disabled style="background-color: var(--accent-color-red); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Confirmar Eliminación</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const confirmEmailInput = document.getElementById('confirm-delete-email');
        const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
        const deleteErrorMessage = document.getElementById('delete-error-message');

        const currentUserEmail = currentUser?.email;

        confirmEmailInput.addEventListener('input', () => {
            if (confirmEmailInput.value.trim().toLowerCase() === currentUserEmail?.toLowerCase()) {
                confirmDeleteBtn.disabled = false;
                deleteErrorMessage.textContent = '';
            } else {
                confirmDeleteBtn.disabled = true;
                deleteErrorMessage.textContent = 'El email no coincide.';
            }
        });

        confirmDeleteBtn.addEventListener('click', async () => {
            if (confirmDeleteBtn.disabled) return;
            
            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.textContent = 'Procesando...';
            
            const success = await miCuenta.deleteAccount();
            if (success) {
                modal.remove();
            } else {
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.textContent = 'Confirmar Eliminación';
                deleteErrorMessage.textContent = 'Error al eliminar los datos.';
            }
        });
    },

    deleteAccount: async () => {
        ui.showNotification('Eliminando datos...', 'info');
        try {
            // Llamamos a la lógica cliente en api.js para evitar el error de CORS 
            // que tiene la Edge Function configurada para el dominio oficial.
            return await api.deleteUserAccountAndData();
        } catch (err) {
            ui.showNotification('Error al eliminar cuenta: ' + err.message, 'error');
            return false;
        }
    },
};