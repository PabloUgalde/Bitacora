// =================================================================
// ONBOARDING.JS
// Wizard de bienvenida para usuarios nuevos — 5 pasos
// Se activa automáticamente si el usuario no tiene licencias
// =================================================================

const onboarding = {

    currentStep: 0,

    STEPS: [
        {
            icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
            title: '¡Bienvenido a Mi Bitácora de Vuelo!',
            body: 'Tu bitácora digital profesional. En los próximos pasos te ayudaremos a configurar tu perfil para que todo funcione correctamente.',
            action: 'Comenzar →',
            skip: true,
            skipLabel: 'Saltar introducción',
        },
        {
            icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8 14h4M8 17h8"/></svg>`,
            title: 'Tus licencias DGAC',
            body: 'Para poder ocupar la aplicacion primero agrega tu licencia de piloto (Alumno, Privado, Comercial, ATPL) y sus habilitaciones. Esto determina si eres alumno o piloto al mando en cada vuelo. Una vez lo hayas hecho haz click en "Guardar Configuración" para continuar.',
            action: 'Ir a Licencias →',
            skip: true,
            onAction: () => {
                onboarding.hide();
                ui.showView('view-settings');
                setTimeout(() => {
                    document.querySelector('[data-panel="panel-licencias"]')?.click();
                }, 300);
                onboarding._waitForLicencias();
            }
        },
        {
            icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
            title: 'Tus datos personales',
            body: 'En Configuración → Datos Personales puedes ingresar tu RUT, teléfono y domicilio. Esta información aparecerá en tus reportes impresos.',
            action: 'Entendido →',
            skip: false,
        },
        {
            icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
            title: 'Tu dashboard',
            body: 'El dashboard muestra un resumen de tus horas totales, PIC, IFR, aterrizajes y más. Puedes personalizar qué tiles mostrar en Configuración → Dashboard.',
            action: 'Siguiente →',
            skip: false,
            visual: `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:12px 0;">
                    <div style="background:#181818; border:1px solid #252525; border-radius:6px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; color:#555;">Horas Totales</span>
                        <span style="font-size:16px; font-weight:700; color:#c9a84c;">529.0</span>
                    </div>
                    <div style="background:#181818; border:1px solid #252525; border-radius:6px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; color:#555;">Horas PIC</span>
                        <span style="font-size:16px; font-weight:700; color:#c9a84c;">463.2</span>
                    </div>
                    <div style="background:#181818; border:1px solid #252525; border-radius:6px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; color:#555;">Horas IFR</span>
                        <span style="font-size:16px; font-weight:700; color:#c9a84c;">47.7</span>
                    </div>
                    <div style="background:#181818; border:1px solid #252525; border-radius:6px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; color:#555;">Aterrizajes</span>
                        <span style="font-size:16px; font-weight:700; color:#c9a84c;">1221</span>
                    </div>
                </div>`
        },
        {
            icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`,
            title: 'Registra tu primer vuelo',
            body: 'Usa el menú Bitácora → Añadir Vuelo para registrar tu primer vuelo. Completa los 4 pasos: datos del vuelo, tiempos, roles y revisión.',
            action: 'Añadir mi primer vuelo →',
            skip: true,
            skipLabel: 'Saltar este paso',
            skipAction: 'onboarding.currentStep = 5; onboarding.show();',
            onAction: () => {
                onboarding.hide();
                addFlightModal.open();
                const checkClosed = setInterval(() => {
                    const modal = document.getElementById('add-flight-overlay');
                    if (modal && modal.style.display === 'none') {
                        clearInterval(checkClosed);
                        onboarding.currentStep = 5;
                        onboarding.show();
                    }
                }, 500);
                setTimeout(() => clearInterval(checkClosed), 600000);
            }
        },
        {
            icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
            title: 'Personaliza tus tiles',
            body: 'Elige qué métricas quieres ver en tu dashboard. Puedes cambiarlas cuando quieras desde Configuración → Dashboard. Con esto ya estás listo para comenzar a utilizar tu Bitácora Digital',
            action: 'Ir a personalizar →',
            skip: false,
            onAction: () => {
                onboarding.finish();
                ui.showView('view-settings');
                setTimeout(() => {
                    document.querySelector('[data-panel="panel-dashboard"]')?.click();
                }, 300);
            }
        },    ],

    _waitForLicencias() {
        const handler = () => {
            const data = licenseSystem.getData();
            const lics = data?.licencias || [];
            if (lics.length > 0) {
                window.removeEventListener('settings-saved', handler);
                onboarding.currentStep = 2;
                onboarding.show();
            } else {
                ui.showNotification('Agrega al menos una licencia y guarda para continuar.', 'info');
            }
        };
        window.removeEventListener('settings-saved', handler); // limpiar anterior si existe
        window.addEventListener('settings-saved', handler);
        // Limpiar después de 10 minutos por si el usuario abandona
        setTimeout(() => window.removeEventListener('settings-saved', handler), 600000);
    },

    show() {
        if (this.currentStep === 0) {
            // Solo resetear si es inicio real
        }
        this._render();
    },

    hide() {
        const overlay = document.getElementById('onboarding-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    finish() {
        // Marcar onboarding como completado
        localStorage.setItem('onboarding_done_' + currentUser?.id, 'true');
        const overlay = document.getElementById('onboarding-overlay');
        if (overlay) overlay.remove();
    },

    isDone() {
        return localStorage.getItem('onboarding_done_' + currentUser?.id) === 'true';
    },

    next() {
        if (this.currentStep < this.STEPS.length - 1) {
            this.currentStep++;
            this._render();
        } else {
            this.finish();
        }
    },

    _render() {
        let overlay = document.getElementById('onboarding-overlay');
        const step = this.STEPS[this.currentStep];
        const total = this.STEPS.length;
        const current = this.currentStep;

        const dotsHtml = Array.from({ length: total }, (_, i) => {
            let cls = 'ob-dot';
            if (i < current) cls += ' done';
            else if (i === current) cls += ' active';
            return `<div class="${cls}"></div>`;
        }).join('');

        const cardHtml = `
        <div class="ob-card">
            <div class="ob-dots">${dotsHtml}</div>
            <div class="ob-icon">${step.icon}</div>
            <h2>${step.title}</h2>
            <p>${step.body}</p>
            ${step.visual || ''}
            <button class="ob-btn" onclick="onboarding._onAction()">
                ${step.action}
            </button>
            ${step.skip ? `<div class="ob-skip" onclick="${step.skipAction || 'onboarding.finish()'}">
            ${step.skipLabel || 'Omitir configuración'}
        </div>` : ''}
            ${current > 0 ? `<div class="ob-back" onclick="onboarding._back()">← Anterior</div>` : ''}
        </div>`;

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'onboarding-overlay';

            const style = document.createElement('style');
            style.textContent = `
            #onboarding-overlay {
                position: fixed; inset: 0; z-index: 9996;
                background: rgba(0,0,0,0.88);
                display: flex; align-items: center; justify-content: center;
                backdrop-filter: blur(4px);
                padding: 20px;
                overflow-y: auto;
            }
            .ob-card {
                background: #1a1a1a;
                border: 1px solid #2a2a2a;
                border-radius: 16px;
                padding: 36px 32px;
                width: 100%; max-width: 420px;
                text-align: center;
                margin: auto;
            }
            .ob-dots { display: flex; justify-content: center; gap: 6px; margin-bottom: 24px; }
            .ob-dot { width: 8px; height: 8px; border-radius: 50%; background: #2a2a2a; transition: all 0.2s; }
            .ob-dot.active { background: #c9a84c; width: 24px; border-radius: 4px; }
            .ob-dot.done { background: #2d5a2d; }
            .ob-icon {
                width: 64px; height: 64px;
                background: #1c1a10; border: 1px solid #c9a84c30;
                border-radius: 16px;
                display: flex; align-items: center; justify-content: center;
                margin: 0 auto 20px;
            }
            .ob-card h2 { color: #c9a84c; font-size: 19px; font-weight: 700; margin-bottom: 10px; }
            .ob-card > p { color: #777; font-size: 13px; line-height: 1.7; margin-bottom: 20px; }
            .ob-btn {
                background: #c9a84c; color: #000;
                border: none; border-radius: 8px;
                padding: 12px 32px; font-size: 14px; font-weight: 700;
                cursor: pointer; width: 100%; margin-bottom: 10px;
                transition: opacity 0.2s;
            }
            .ob-btn:hover { opacity: 0.9; }
            .ob-skip { font-size: 12px; color: #888; cursor: pointer; margin-top: 4px; }
            .ob-skip:hover { color: #bbb; }
            .ob-back { font-size: 12px; color: #888; cursor: pointer; margin-top: 8px; }
            .ob-back:hover { color: #bbb; }
            @media (max-width: 480px) {
                .ob-card { padding: 28px 20px; }
            }`;
            document.head.appendChild(style);
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = cardHtml;
        overlay.style.display = 'flex';

        // Re-aplicar estilos inline al card ya que innerHTML reemplazó todo
        const card = overlay.querySelector('.ob-card');
        if (card) {
            card.style.cssText = `background:#1a1a1a; border:1px solid #2a2a2a; border-radius:16px; padding:36px 32px; width:100%; max-width:420px; text-align:center; margin:auto;`;
        }
    },

    _onAction() {
            const step = this.STEPS[this.currentStep];
            if (step.onAction) {
                step.onAction();
            } else {
                this.next();
            }
    },

    _back() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this._render();
        }
    }
};
