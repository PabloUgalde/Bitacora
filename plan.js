const plan = {

    isPro() {
        if (!userProfile?.plan) return false;
        if (userProfile.plan === 'pro') {
            if (userProfile.planExpiresAt) {
                return new Date(userProfile.planExpiresAt) > new Date();
            }
            return true;
        }
        return false;
    },

    PRO_FEATURES: [
        'view-summary-by-aircraft',
        'view-summary-by-airport',
        'view-summary-ifr',
        'view-summaries-by-page',
    ],

    reset() {
    // Restaurar todos los nav links bloqueados
    document.querySelectorAll('.nav-dropdown-menu .nav-link').forEach(link => {
        link.style.opacity = '';
        link.style.pointerEvents = '';
        link.title = '';
    });
    // Restaurar showView original si fue interceptado
    if (ui._originalShowView) {
        ui.showView = ui._originalShowView;
        delete ui._originalShowView;
    }
    },

    apply() {
        plan.reset();
        if (plan.isPro()) return;

        plan.PRO_FEATURES.forEach(viewId => {
            const navLink = document.querySelector(
                `.nav-dropdown-menu .nav-link[data-view="${viewId}"]`
            );
            if (navLink) {
                navLink.style.opacity = '0.4';
                navLink.style.pointerEvents = 'none';
                navLink.title = 'Función Pro';
            }
        });

        const originalShowView = ui.showView;
        ui.showView = (viewId) => {
            if (plan.PRO_FEATURES.includes(viewId)) {
                plan.showUpgradeScreen();
                return;
            }
            originalShowView(viewId);
        };

        document.getElementById('download-excel-btn')?.addEventListener('click', (e) => {
            if (!plan.isPro()) { e.stopImmediatePropagation(); plan.showUpgradeScreen(); }
        }, true);

        document.getElementById('download-csv-btn')?.addEventListener('click', (e) => {
            if (!plan.isPro()) { e.stopImmediatePropagation(); plan.showUpgradeScreen(); }
        }, true);

        document.getElementById('open-filter-modal-btn')?.addEventListener('click', (e) => {
            if (!plan.isPro()) { e.stopImmediatePropagation(); plan.showUpgradeScreen(); }
        }, true);
        document.getElementById('open-print-modal-btn')?.addEventListener('click', (e) => {
        if (!plan.isPro()) { e.stopImmediatePropagation(); plan.showUpgradeScreen(); }
        }, true);
    },

    async checkout(planType) {
        const plansDiv = document.querySelector('.upgrade-plans');
        if (plansDiv) plansDiv.innerHTML = '<div class="upgrade-loading">Preparando pago...</div>';

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No hay sesión activa');

            const res = await fetch(
                'https://rdnniehpsdforkfngwrf.supabase.co/functions/v1/create-checkout',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ plan: planType }),
                }
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            window.location.href = data.url;
        } catch (err) {
            if (plansDiv) plansDiv.innerHTML = `<div class="upgrade-loading" style="color:#ef4444">Error: ${err.message}</div>`;
        }
    },

    showUpgradeScreen() {
        let overlay = document.getElementById('upgrade-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'upgrade-overlay';
            overlay.innerHTML = `
            <div class="upgrade-card">
                <div class="upgrade-icon">✈</div>
                <h2>Actualiza a Pro</h2>
                <p>Accede a todas las funciones de la bitácora profesional.</p>
                <div class="upgrade-features">
                    <div class="upgrade-feature">✓ Resumen por aeronave y aeródromo</div>
                    <div class="upgrade-feature">✓ Resumen IFR y recencia</div>
                    <div class="upgrade-feature">✓ Filtro avanzado</div>
                    <div class="upgrade-feature">✓ Exportar Excel y CSV</div>
                    <div class="upgrade-feature">✓ Reporte de impresión</div>
                </div>
                <div class="upgrade-plans">
                    <button class="upgrade-plan-btn" onclick="plan.checkout('monthly')">
                        <span class="plan-name">Mensual</span>
                        <span class="plan-price">$5.000 CLP/mes</span>
                    </button>
                    <button class="upgrade-plan-btn featured" onclick="plan.checkout('annual')">
                        <span class="plan-badge">Mejor valor</span>
                        <span class="plan-name">Anual</span>
                        <span class="plan-price">$40.000 CLP/año</span>
                        <span class="plan-saving">2 meses gratis</span>
                    </button>
                </div>
                <button class="upgrade-btn-secondary" onclick="plan.hideUpgradeScreen()">Más adelante</button>
            </div>`;

            const style = document.createElement('style');
            style.textContent = `
            #upgrade-overlay {
                position: fixed; inset: 0; z-index: 9998;
                background: rgba(0,0,0,0.85);
                display: flex; align-items: center; justify-content: center;
                backdrop-filter: blur(4px);
            }
            .upgrade-card {
                background: #1a1a1a; border: 1px solid #c9a84c;
                border-radius: 16px; padding: 36px 32px;
                width: 100%; max-width: 440px; text-align: center;
                box-shadow: 0 0 40px rgba(201,168,76,0.15);
            }
            .upgrade-icon { font-size: 36px; margin-bottom: 12px; }
            .upgrade-card h2 { color: #c9a84c; font-size: 22px; margin-bottom: 8px; }
            .upgrade-card p { color: #888; font-size: 13px; line-height: 1.6; margin-bottom: 16px; }
            .upgrade-features { text-align: left; margin-bottom: 20px; }
            .upgrade-feature { color: #aaa; font-size: 13px; padding: 3px 0; }
            .upgrade-plans { display: flex; gap: 12px; margin-bottom: 16px; }
            .upgrade-plan-btn {
                flex: 1; background: #222; border: 1px solid #333;
                border-radius: 10px; padding: 14px 10px; cursor: pointer;
                display: flex; flex-direction: column; align-items: center;
                gap: 4px; transition: border-color 0.2s;
            }
            .upgrade-plan-btn:hover { border-color: #c9a84c; }
            .upgrade-plan-btn.featured { border-color: #c9a84c; background: #1c1a10; }
            .plan-badge {
                font-size: 10px; background: #c9a84c; color: #000;
                padding: 2px 8px; border-radius: 4px; font-weight: 700;
            }
            .plan-name { font-size: 14px; color: #fff; font-weight: 600; }
            .plan-price { font-size: 13px; color: #c9a84c; font-weight: 700; }
            .plan-saving { font-size: 11px; color: #4a9a4a; }
            .upgrade-loading { text-align: center; color: #c9a84c; font-size: 13px; padding: 20px; }
            .upgrade-btn-secondary {
                background: transparent; border: 1px solid #333;
                color: #555; border-radius: 8px; padding: 8px 20px;
                cursor: pointer; font-size: 12px; width: 100%;
            }
            .upgrade-btn-secondary:hover { color: #888; border-color: #555; }
            `;
            document.head.appendChild(style);
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    },

    hideUpgradeScreen() {
        const overlay = document.getElementById('upgrade-overlay');
        if (overlay) overlay.style.display = 'none';
    },

};
