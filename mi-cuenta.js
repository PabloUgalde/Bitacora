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

    confirmDeleteAccount: () => {
        const confirmed = confirm(
            '⚠️ ¿Estás seguro?\n\nEsto eliminará permanentemente tu cuenta y todos tus vuelos. Esta acción no se puede deshacer.'
        );
        if (!confirmed) return;
        const reconfirmed = confirm('Última confirmación: ¿eliminar cuenta definitivamente?');
        if (!reconfirmed) return;
        miCuenta.deleteAccount();
    },

    deleteAccount: async () => {
        ui.showNotification('Eliminando cuenta...', 'info');
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const token = session?.access_token;
            const res = await fetch(
                'https://rdnniehpsdforkfngwrf.supabase.co/functions/v1/delete-account',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            await supabaseClient.auth.signOut();
            window.location.reload();
        } catch (err) {
            ui.showNotification('Error al eliminar cuenta: ' + err.message, 'error');
        }
    },
};