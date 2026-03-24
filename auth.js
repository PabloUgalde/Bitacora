// =================================================================
// AUTH.JS - Sistema de autenticación con Supabase
// Carga antes que app.js y bloquea la UI hasta verificar sesión
// =================================================================

var SUPABASE_URL = 'https://rdnniehpsdforkfngwrf.supabase.co';       // ← reemplaza
var SUPABASE_ANON_KEY = 'sb_publishable_iavyVSmxuwncUjdCM9e9kw_5c4QC-b5';                          // ← reemplaza (publishable key)

// Cliente Supabase (se inicializa con la librería CDN)
let supabaseClient = null;
let currentUser = null;

const auth = {

    // ── Inicialización ────────────────────────────────────────────
    init: async () => {
        if (!window.supabase) {
            console.error("Supabase SDK no cargó. ");
            return false;
        }
        delete document.body.dataset.listenersAttached;  // ← agregar aquí
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            
            // Detectar retorno desde link de recovery
            const hash = window.location.hash;
            if (hash.includes('type=recovery')) {
                const params = new URLSearchParams(hash.replace('#', ''));
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');
                if (accessToken) {
                    await supabaseClient.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken || ''
                    });
                    auth._showAuthScreen('reset');
                    window.history.replaceState({}, '', window.location.pathname);
                    return false; // No continuar con el flujo normal
                }
            }
            // Verificar si ya hay sesión activa
            const { data: { session } } = await supabaseClient.auth.getSession();

            if (session) {
                currentUser = session.user;
                auth._hideAuthScreen();
                return true; // ya autenticado
            } else {
                auth._showAuthScreen('login');
                return false; // debe autenticarse
            }
        },

    // ── Login ─────────────────────────────────────────────────────
    login: async (email, password) => {
        auth._setLoading(true, 'Iniciando sesión...');
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            auth._setLoading(false);
            auth._showError(auth._translateError(error.message));
            return false;
        }
        window.location.reload();
        return true;
},

    // ── Registro ──────────────────────────────────────────────────
    register: async (email, password, name) => {
        auth._setLoading(true, 'Creando cuenta...');
        const { data, error } = await supabaseClient.auth.signUp({
            email, password,
            options: { data: { full_name: name } }
        });
        if (error) {
            auth._setLoading(false);
            auth._showError(auth._translateError(error.message));
            return false;
        }
        auth._setLoading(false);
        auth._showSuccess('¡Cuenta creada! Iniciando sesión...');
        setTimeout(() => {
            window.location.reload();
        }, 1500);
        return true;
    },

    // ── Recuperar contraseña ──────────────────────────────────────
    forgotPassword: async (email) => {
        auth._setLoading(true, 'Enviando email...');
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname
        });
        auth._setLoading(false);
        if (error) {
            auth._showError(auth._translateError(error.message));
            return false;
        }
        auth._showSuccess('Email enviado. Revisa tu bandeja de entrada y sigue el enlace para restablecer tu contraseña.');
        return true;
    },

    // ── Nueva contraseña (después de link de recuperación) ────────
    updatePassword: async (newPassword) => {
        auth._setLoading(true, 'Actualizando contraseña...');
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        auth._setLoading(false);
        if (error) {
            auth._showError(auth._translateError(error.message));
            return false;
        }
        auth._showSuccess('Contraseña actualizada correctamente.');
        setTimeout(() => auth._showAuthScreen('login'), 2000);
        return true;
    },

    // ── Cerrar sesión ─────────────────────────────────────────────
    logout: async () => {
        await supabaseClient.auth.signOut();
        currentUser = null;
        if (typeof flightData !== 'undefined') flightData = [];
        delete document.body.dataset.listenersAttached;
        setTimeout(() => {
            // Eliminar overlay existente para forzar reconstrucción limpia
            const existing = document.getElementById('auth-overlay');
            if (existing) existing.remove();
            auth._showAuthScreen('login');
        }, 100);
    },

    // ── Helpers UI ────────────────────────────────────────────────
    _showAuthScreen: (panel = 'login') => {
        let overlay = document.getElementById('auth-overlay');
        if (!overlay) {
            overlay = auth._buildAuthScreen();
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        auth._switchPanel(panel);
        auth._clearMessages();
    },

    _hideAuthScreen: () => {
        const overlay = document.getElementById('auth-overlay');
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = '';
    },

    _switchPanel: (panel) => {
        ['panel-login', 'panel-register', 'panel-forgot', 'panel-reset'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = id === `panel-${panel}` ? 'block' : 'none';
        });
        auth._clearMessages();
    },

    _setLoading: (loading, msg = '') => {
        const btn = document.querySelector('#auth-overlay .auth-submit-btn');
        if (!btn) return;
        btn.disabled = loading;
        btn.textContent = loading ? msg : btn.dataset.label;
    },

    _showError: (msg) => {
        const el = document.getElementById('auth-message');
        if (!el) return;
        el.textContent = msg;
        el.className = 'auth-message error';
    },

    _showSuccess: (msg) => {
        const el = document.getElementById('auth-message');
        if (!el) return;
        el.textContent = msg;
        el.className = 'auth-message success';
    },

    _clearMessages: () => {
        const el = document.getElementById('auth-message');
        if (el) { el.textContent = ''; el.className = 'auth-message'; }
    },

    _translateError: (msg) => {
        const map = {
            'Invalid login credentials':          'Email o contraseña incorrectos.',
            'Email not confirmed':                 'Debes confirmar tu email antes de iniciar sesión.',
            'User already registered':             'Ya existe una cuenta con ese email.',
            'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
            'Unable to validate email address':    'El email ingresado no es válido.',
            'Email rate limit exceeded':           'Demasiados intentos. Espera unos minutos.',
            'over_email_send_rate_limit':          'Demasiados intentos. Espera unos minutos.',
        };
        for (const [key, val] of Object.entries(map)) {
            if (msg.includes(key)) return val;
        }
        return msg;
    },

    // ── Construir pantalla de auth ────────────────────────────────
    _buildAuthScreen: () => {
        const overlay = document.createElement('div');
        overlay.id = 'auth-overlay';
        overlay.innerHTML = `
        <div class="auth-card" style="position:relative;">
            <button onclick="window.location.href='/landing.html'" style="position:absolute; top:12px; right:16px; background:transparent; border:none; color:#555; font-size:24px; cursor:pointer; line-height:1; padding:4px; z-index:10;" title="Volver al inicio">×</button>
            <div class="auth-logo">
                <div class="pilot-epaulette">
                    <div class="stripe"></div><div class="stripe"></div>
                    <div class="stripe"></div><div class="stripe"></div>
                </div>
                <span>Mi Bitácora de Vuelo</span>
            </div>

            <p id="auth-message" class="auth-message"></p>

            <!-- LOGIN -->
            <div id="panel-login">
                <h2 class="auth-title">Iniciar sesión</h2>
                <div class="auth-field">
                    <label>Email</label>
                    <input type="email" id="auth-email" placeholder="piloto@ejemplo.com" autocomplete="email">
                </div>
                <div class="auth-field">
                    <label>Contraseña</label>
                    <input type="password" id="auth-password" placeholder="••••••••" autocomplete="current-password">
                </div>
                <button class="auth-submit-btn" data-label="Iniciar sesión" onclick="auth.login(
                    document.getElementById('auth-email').value,
                    document.getElementById('auth-password').value
                )">Iniciar sesión</button>
                <div class="auth-links">
                    <a href="#" onclick="auth._switchPanel('forgot'); return false;">¿Olvidaste tu contraseña?</a>
                    <a href="#" onclick="auth._switchPanel('register'); return false;">Crear cuenta nueva</a>
                </div>
            </div>

            <!-- REGISTRO -->
            <form id="panel-register" style="display:none" onsubmit="return false;">
                <h2 class="auth-title">Crear cuenta</h2>
                <div class="auth-field">
                    <label>Nombre completo</label>
                    <input type="text" id="auth-name" placeholder="Juan Pérez" autocomplete="name">
                </div>
                <div class="auth-field">
                    <label>Email</label>
                    <input type="email" id="auth-reg-email" placeholder="piloto@ejemplo.com" autocomplete="email">
                </div>
                <div class="auth-field">
                    <label>Contraseña</label>
                    <input type="password" id="auth-reg-password" placeholder="Mínimo 6 caracteres" autocomplete="new-password">
                </div>
                <button class="auth-submit-btn" data-label="Crear cuenta" onclick="auth.register(
                    document.getElementById('auth-reg-email').value,
                    document.getElementById('auth-reg-password').value,
                    document.getElementById('auth-name').value
                )">Crear cuenta</button>
                <div class="auth-links">
                    <a href="#" onclick="auth._switchPanel('login'); return false;">← Volver al inicio de sesión</a>
                </div>
                <p style="font-size:11px; color:#444; text-align:center; margin-top:12px;">
                    Al registrarte aceptas nuestros 
                    <a href="/terminos.html" target="_blank" style="color:#c9a84c;">Términos</a> y 
                    <a href="/privacidad.html" target="_blank" style="color:#c9a84c;">Política de Privacidad</a>.
                </p>
            </form>

            <!-- OLVIDÉ CONTRASEÑA -->
            <form id="panel-forgot" style="display:none">
                <h2 class="auth-title">Recuperar contraseña</h2>
                <p class="auth-hint">Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.</p>
                <div class="auth-field">
                    <label>Email</label>
                    <input type="email" id="auth-forgot-email" placeholder="piloto@ejemplo.com">
                </div>
                <button class="auth-submit-btn" data-label="Enviar enlace" onclick="auth.forgotPassword(
                    document.getElementById('auth-forgot-email').value
                )">Enviar enlace</button>
                <div class="auth-links">
                    <a href="#" onclick="auth._switchPanel('login'); return false;">← Volver al inicio de sesión</a>
                </div>
            </form>

            <!-- NUEVA CONTRASEÑA -->
            <form id="panel-reset" style="display:none">
                <h2 class="auth-title">Nueva contraseña</h2>
                <div class="auth-field">
                    <label>Nueva contraseña</label>
                    <input type="password" id="auth-new-password" placeholder="Mínimo 6 caracteres">
                </div>
                <button class="auth-submit-btn" data-label="Guardar contraseña" onclick="auth.updatePassword(
                    document.getElementById('auth-new-password').value
                )">Guardar contraseña</button>
            </>
        </div>
        `;

        // Estilos del overlay
        const style = document.createElement('style');
        style.textContent = `
        #auth-overlay {
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(0,0,0,0.85);
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(4px);
        }
        .auth-card {
        background: var(--card-bg, #1a1a2e);
        border: 1px solid var(--border-color, #333);
        border-radius: 16px;
        padding: 40px 36px;
        width: 100%; max-width: 420px;
        box-shadow: 0 24px 60px rgba(0,0,0,0.5);
        position: relative;
        overflow: visible;
        }
        .auth-logo {
            display: flex; align-items: center; gap: 12px;
            margin-bottom: 28px;
            font-size: 16px; font-weight: 600;
            color: var(--text-primary, #fff);
        }
        .auth-title {
            font-size: 22px; font-weight: 700;
            color: var(--text-primary, #fff);
            margin: 0 0 20px;
        }
        .auth-field {
            margin-bottom: 16px;
        }
        .auth-field label {
            display: block; font-size: 13px;
            color: var(--text-secondary, #aaa);
            margin-bottom: 6px;
        }
        .auth-field input {
            width: 100%; padding: 10px 14px;
            background: var(--input-bg, #0d0d1a);
            border: 1px solid var(--border-color, #333);
            border-radius: 8px;
            color: var(--text-primary, #fff);
            font-size: 14px; outline: none;
            transition: border-color 0.2s;
            box-sizing: border-box;
        }
        .auth-field input:focus { border-color: var(--accent-color, #c9a84c); }
        .auth-submit-btn {
            width: 100%; padding: 12px;
            background: var(--accent-color, #c9a84c);
            color: #000; border: none; border-radius: 8px;
            font-size: 15px; font-weight: 700;
            cursor: pointer; margin-top: 8px;
            transition: opacity 0.2s;
        }
        .auth-submit-btn:hover { opacity: 0.9; }
        .auth-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .auth-links {
            display: flex; flex-direction: column; gap: 10px;
            margin-top: 20px; text-align: center;
        }
        .auth-links a {
            font-size: 13px;
            color: var(--accent-color, #c9a84c);
            text-decoration: none;
        }
        .auth-links a:hover { text-decoration: underline; }
        .auth-message {
            font-size: 13px; padding: 10px 14px;
            border-radius: 8px; margin-bottom: 16px;
            min-height: 0; transition: all 0.2s;
        }
        .auth-message.error {
            background: rgba(239,68,68,0.15);
            border: 1px solid rgba(239,68,68,0.4);
            color: #f87171;
        }
        .auth-message.success {
            background: rgba(16,185,129,0.15);
            border: 1px solid rgba(16,185,129,0.4);
            color: #34d399;
        }
        .auth-hint {
            font-size: 13px; color: var(--text-secondary, #aaa);
            margin: 0 0 16px; line-height: 1.5;
        }
        @media (max-width: 480px) {
            .auth-card { padding: 28px 20px; margin: 16px; }
        }
        `;
        document.head.appendChild(style);

        // Enter en inputs dispara el botón activo
        overlay.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const btn = overlay.querySelector('.auth-submit-btn:not([disabled])');
            if (btn) btn.click();
        });

        return overlay;
    }
};
