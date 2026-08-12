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

    // Solo para mostrar el % en el modal antes de redirigir a Flow — la
    // validación real ocurre en flow-subscription-return contra el secreto
    // FLOW_COUPON_MAP. Mantener sincronizado a mano (cupones de baja
    // frecuencia, mismo criterio que los precios hardcodeados más abajo).
    COUPON_DISCOUNTS: {
        'PILOTOCUA': 10,
    },

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

        // Registrar los interceptores una sola vez: apply() puede llamarse varias
        // veces por sesión y estos listeners se acumulaban sin poder removerse.
        if (plan._gateListenersBound) return;
        plan._gateListenersBound = true;

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

    isSubscribed() {
        return userProfile?.flowSubscriptionStatus === 'active' ||
               userProfile?.flowSubscriptionStatus === 'trial';
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

    async activateAutopay(planType) {
        // Leer el cupón ANTES de vaciar .upgrade-plans — el input vive adentro
        // de ese div y se borraría a sí mismo si se lee después.
        const couponCode = planType === 'annual'
            ? document.getElementById('autopay-annual-coupon')?.value.trim()
            : '';

        const plansDiv = document.querySelector('.upgrade-plans');
        if (plansDiv) plansDiv.innerHTML = '<div class="upgrade-loading">Preparando registro de tarjeta...</div>';

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No hay sesión activa');

            const res = await fetch(
                'https://rdnniehpsdforkfngwrf.supabase.co/functions/v1/flow-subscription-start',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ plan: planType, couponCode: couponCode || undefined }),
                }
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            window.location.href = data.url;
        } catch (err) {
            if (plansDiv) plansDiv.innerHTML = `<div class="upgrade-loading" style="color:#ef4444">Error: ${err.message}</div>`;
        }
    },

    // Ciclo de facturación actualmente seleccionado en el toggle del modal.
    _cycle() {
        return document.getElementById('upgrade-billing-toggle')?.checked ? 'annual' : 'monthly';
    },

    _onBillingToggle(isAnnual) {
        document.getElementById('upgrade-toggle-label-monthly')?.classList.toggle('active', !isAnnual);
        document.getElementById('upgrade-toggle-label-annual')?.classList.toggle('active', isAnnual);

        const priceEl = document.getElementById('upgrade-pro-price');
        if (priceEl) {
            priceEl.style.opacity = '0';
            setTimeout(() => {
                priceEl.innerHTML = isAnnual
                    ? '$60.000<br><span style="font-size:9px; font-weight:400;">/año</span>'
                    : '$6.000<br><span style="font-size:9px; font-weight:400;">/mes</span>';
                priceEl.style.opacity = '1';
            }, 120);
        }

        // Técnica FLIP: justify-content no anima de forma confiable en todos
        // los navegadores, así que medimos la posición del toggle antes y
        // después del cambio de layout y animamos la diferencia con transform.
        const toggle = document.querySelector('.upgrade-toggle');
        const firstLeft = toggle ? toggle.getBoundingClientRect().left : null;

        document.getElementById('upgrade-toggle-row')?.classList.toggle('split', isAnnual);
        document.getElementById('upgrade-coupon-row')?.classList.toggle('visible', isAnnual);

        if (toggle && firstLeft !== null) {
            const lastLeft = toggle.getBoundingClientRect().left;
            const delta = firstLeft - lastLeft;
            if (delta !== 0) {
                toggle.style.transition = 'none';
                toggle.style.transform = `translateX(${delta}px)`;
                requestAnimationFrame(() => {
                    toggle.style.transition = 'transform 0.3s ease';
                    toggle.style.transform = 'translateX(0)';
                });
            }
        }

        // Resetear el cupón al cambiar de ciclo — un código aplicado en anual
        // no debe quedar "colgado" si el usuario vuelve a mensual y luego a anual.
        const input = document.getElementById('autopay-annual-coupon');
        const feedback = document.getElementById('upgrade-coupon-feedback');
        if (input) input.value = '';
        if (feedback) feedback.textContent = '';
    },

    _applyCoupon() {
        const input = document.getElementById('autopay-annual-coupon');
        const feedback = document.getElementById('upgrade-coupon-feedback');
        const priceEl = document.getElementById('upgrade-pro-price');
        if (!input || !feedback || !priceEl) return;

        const code = input.value.trim().toUpperCase();
        const discount = plan.COUPON_DISCOUNTS[code];
        const basePrice = '$60.000<br><span style="font-size:9px; font-weight:400;">/año</span>';

        if (!code) {
            feedback.textContent = '';
            priceEl.innerHTML = basePrice;
            return;
        }
        if (!discount) {
            feedback.textContent = 'Código no válido';
            feedback.style.color = '#ef4444';
            priceEl.innerHTML = basePrice;
            return;
        }
        const finalPrice = Math.round(60000 * (1 - discount / 100));
        feedback.textContent = `✓ ${discount}% de descuento aplicado`;
        feedback.style.color = '#4a9a4a';
        priceEl.innerHTML = `$${finalPrice.toLocaleString('es-CL')}<br><span style="font-size:9px; font-weight:400;">/año</span>`;
    },

    async cancelSubscription() {
        if (!confirm('¿Cancelar el cargo automático? Tu Plan Pro seguirá activo hasta la fecha de vencimiento actual, pero no se renovará solo.')) return;

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No hay sesión activa');

            const res = await fetch(
                'https://rdnniehpsdforkfngwrf.supabase.co/functions/v1/flow-subscription-cancel',
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

            const updatedProfile = await api.loadProfile();
            if (updatedProfile) userProfile = { ...userProfile, ...updatedProfile };
            app.loadSettings();
            ui.showNotification('Cargo automático cancelado. Tu Plan Pro sigue activo hasta que venza.', 'success');
        } catch (err) {
            ui.showNotification(`No se pudo cancelar: ${err.message}`, 'error');
        }
    },

showUpgradeScreen() {
    const existing = document.getElementById('upgrade-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'upgrade-overlay';
    overlay.innerHTML = `
    <div class="upgrade-card">
        <button onclick="plan.hideUpgradeScreen()" style="position:absolute; top:14px; right:16px; background:none; border:none; color:#555; font-size:22px; cursor:pointer; line-height:1;">×</button>
        <div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:6px;">
            <span class="upgrade-icon" style="margin-bottom:0;">✈</span>
            <h2 style="margin-bottom:0;">Actualiza a Pro</h2>
        </div>
        <p>Accede a todas las funciones de la bitácora profesional.</p>
        <div class="upgrade-compare">
            <div class="upgrade-compare-header">
                <div></div>
                <div class="upgrade-col-lite">Lite</div>
                <div class="upgrade-col-pro">Pro ✈</div>
            </div>
            <div class="upgrade-compare-row">
                <div>Registro de vuelos</div>
                <div>✓</div><div>✓</div>
            </div>
            <div class="upgrade-compare-row">
                <div>Dashboard básico</div>
                <div>✓</div><div>✓</div>
            </div>
            <div class="upgrade-compare-row">
                <div>Resumen anual y mensual</div>
                <div>✓</div><div>✓</div>
            </div>
            <div class="upgrade-compare-row highlight">
                <div>Resumen por aeronave y aeródromo</div>
                <div style="color:#7a2020">✗</div><div>✓</div>
            </div>
            <div class="upgrade-compare-row highlight">
                <div>Resumen IFR y recencia</div>
                <div style="color:#7a2020">✗</div><div>✓</div>
            </div>
            <div class="upgrade-compare-row highlight">
                <div>Filtro avanzado</div>
                <div style="color:#7a2020">✗</div><div>✓</div>
            </div>
            <div class="upgrade-compare-row highlight">
                <div>Exportar Excel y CSV</div>
                <div style="color:#7a2020">✗</div><div>✓</div>
            </div>
            <div class="upgrade-compare-row highlight">
                <div>Reporte de impresión</div>
                <div style="color:#7a2020">✗</div><div>✓</div>
            </div>
            <div class="upgrade-compare-row upgrade-price-row">
                <div>Precio</div>
                <div>$0</div>
                <div id="upgrade-pro-price">$6.000<br><span style="font-size:9px; font-weight:400;">/mes</span></div>
            </div>
        </div>
        <div class="upgrade-plans" style="flex-direction:column; align-items:stretch;">
            ${!userProfile?.trial_used ? `
            <button class="upgrade-plan-btn featured" onclick="plan.checkout('trial')" style="width:100%; flex-direction:row; justify-content:space-between; padding:14px 18px;">
                <div style="display:flex; flex-direction:column; align-items:flex-start; gap:3px;">
                    <span class="plan-name">Probar Pro gratis</span>
                    <span style="font-size:11px; color:#888;">14 días · sin compromiso</span>
                </div>
                <span class="plan-badge" style="font-size:11px; padding:4px 10px;">Sin tarjeta</span>
            </button>
            <div style="text-align:center; color:#888; font-size:11px; margin: 4px 0;">— o elige un plan —</div>
            ` : ''}
            <div class="upgrade-toggle-row" id="upgrade-toggle-row">
                <div class="upgrade-toggle" style="margin-bottom:0;">
                    <span class="upgrade-toggle-label active" id="upgrade-toggle-label-monthly">Mensual</span>
                    <label class="upgrade-toggle-switch">
                        <input type="checkbox" id="upgrade-billing-toggle" onchange="plan._onBillingToggle(this.checked)">
                        <span class="upgrade-toggle-slider"></span>
                    </label>
                    <span class="upgrade-toggle-label" id="upgrade-toggle-label-annual">Anual <span class="plan-badge" style="font-size:9px; padding:2px 6px;">2 meses gratis</span></span>
                </div>
                <div id="upgrade-coupon-row">
                    <input id="autopay-annual-coupon" type="text" placeholder="Cupón (solo cargo automático)" class="upgrade-coupon-input">
                    <button class="upgrade-btn-secondary" style="width:auto; padding:6px 12px;" onclick="plan._applyCoupon()">Aplicar</button>
                </div>
            </div>
            <div id="upgrade-coupon-feedback" style="font-size:11px; min-height:14px; text-align:right; margin-bottom:2px;"></div>
            <div style="display:flex; gap:10px; margin-top:4px;">
                <button class="upgrade-plan-btn" style="flex:1;" onclick="plan.checkout(plan._cycle())">
                    Pagar una vez
                    <span class="upgrade-cta-sub">Sin renovación automática</span>
                </button>
                <button class="upgrade-cta-primary" style="flex:1;" onclick="plan.activateAutopay(plan._cycle())">
                    ✈ Activar cargo automático
                    <span class="upgrade-cta-sub">Recomendado · se renueva solo</span>
                </button>
            </div>
        </div>
        <button class="upgrade-btn-secondary" onclick="plan.hideUpgradeScreen()">Más adelante</button>
    </div>`;

    const style = document.createElement('style');
    style.textContent = `
    #upgrade-overlay {
        position: fixed; inset: 0; z-index: 9998;
        background: rgba(0,0,0,0.85);
        display: flex; align-items: flex-start; justify-content: center;
        backdrop-filter: blur(4px);
        overflow-y: auto;
        padding: 20px;
    }
    .upgrade-card {
        background: #1a1a1a; border: 1px solid #c9a84c;
        border-radius: 16px; padding: 36px 32px;
        width: 100%; max-width: 520px; text-align: center;
        box-shadow: 0 0 40px rgba(201,168,76,0.15);
        margin: auto; position: relative;
    }
    .upgrade-icon { font-size: 36px; margin-bottom: 12px; }
    .upgrade-card h2 { color: #c9a84c; font-size: 22px; margin-bottom: 8px; }
    .upgrade-card > p { color: #888; font-size: 13px; line-height: 1.6; margin-bottom: 16px; }
    .upgrade-compare { margin-bottom: 16px; border: 1px solid #222; border-radius: 8px; overflow: hidden; }
    .upgrade-compare-header { display: grid; grid-template-columns: 1fr 60px 60px; background: #111; padding: 8px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #aaa; text-align: center; }
    .upgrade-compare-header .upgrade-col-pro { color: #c9a84c; }
    .upgrade-compare-row { display: grid; grid-template-columns: 1fr 60px 60px; padding: 8px 12px; font-size: 12px; color: #888; border-top: 1px solid #1a1a1a; text-align: center; }
    .upgrade-compare-row > div:first-child { text-align: left; color: #aaa; }
    .upgrade-compare-row.highlight > div:first-child { color: #ccc; }
    .upgrade-compare-row div:nth-child(2) { color: #4a9a4a; }
    .upgrade-compare-row div:nth-child(3) { color: #c9a84c; }
    .upgrade-compare-row.highlight { background: #141410; }
    .upgrade-plans { display: flex; gap: 12px; margin-bottom: 16px; }
    .upgrade-plan-btn {
        flex: 1; background: #222; border: 1px solid #333; color: #eee;
        border-radius: 10px; padding: 14px 10px; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
        gap: 4px; transition: border-color 0.2s;
    }
    .upgrade-plan-btn:hover { border-color: #c9a84c; }
    .upgrade-plan-btn.featured { border-color: #c9a84c; background: #1c1a10; }
    .upgrade-cta-primary {
        background: #c9a84c; color: #14120a; border: none;
        border-radius: 10px; padding: 12px 10px; cursor: pointer;
        display: flex; flex-direction: column; align-items: center; gap: 2px;
        font-size: 13px; font-weight: 700; transition: transform 0.1s, box-shadow 0.2s;
        box-shadow: 0 2px 12px rgba(201,168,76,0.25);
    }
    .upgrade-cta-primary:hover { box-shadow: 0 2px 20px rgba(201,168,76,0.45); }
    .upgrade-cta-primary:active { transform: scale(0.98); }
    .upgrade-cta-sub { font-size: 10px; font-weight: 400; opacity: 0.8; }
    .plan-badge { font-size: 10px; background: #c9a84c; color: #000; padding: 2px 8px; border-radius: 4px; font-weight: 700; }
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
    .upgrade-toggle-row {
        display: flex; align-items: center; justify-content: center;
        gap: 14px; margin-bottom: 6px; transition: justify-content 0.25s ease;
        flex-wrap: wrap;
    }
    .upgrade-toggle-row.split { justify-content: space-between; }
    .upgrade-toggle { display: flex; align-items: center; justify-content: center; gap: 10px; }
    #upgrade-coupon-row {
        display: none; align-items: center; gap: 6px;
        opacity: 0; transform: translateX(6px);
        transition: opacity 0.2s ease, transform 0.2s ease;
    }
    #upgrade-coupon-row.visible { display: flex; opacity: 1; transform: translateX(0); }
    .upgrade-toggle-label { font-size: 12px; color: #999; transition: color 0.2s; }
    .upgrade-toggle-label.active { color: #c9a84c; font-weight: 700; }
    .upgrade-toggle-switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
    .upgrade-toggle-switch input { opacity: 0; width: 0; height: 0; }
    .upgrade-toggle-slider {
        position: absolute; cursor: pointer; inset: 0;
        background: #333; border-radius: 22px; transition: background 0.2s;
    }
    .upgrade-toggle-slider::before {
        content: ""; position: absolute; width: 16px; height: 16px;
        left: 3px; bottom: 3px; background: #ccc; border-radius: 50%;
        transition: transform 0.2s;
    }
    .upgrade-toggle-switch input:checked + .upgrade-toggle-slider { background: #c9a84c; }
    .upgrade-toggle-switch input:checked + .upgrade-toggle-slider::before { transform: translateX(18px); background: #111; }
    .upgrade-price-row { border-top: 2px solid #2a2a2a !important; background: #14120a; }
    .upgrade-price-row > div:first-child { color: #ccc; font-weight: 600; }
    .upgrade-price-row div:nth-child(2) { color: #888; }
    #upgrade-pro-price { font-size: 15px; font-weight: 700; transition: opacity 0.15s ease; }
    .upgrade-coupon-input {
        min-width: 0; width: 150px; box-sizing: border-box;
        background: #222; border: 1px solid #444; border-radius: 6px;
        padding: 6px 8px; font-size: 11px; color: #fff;
    }
    .upgrade-coupon-input::placeholder { color: #777; }
    .upgrade-coupon-input:-webkit-autofill,
    .upgrade-coupon-input:-webkit-autofill:hover,
    .upgrade-coupon-input:-webkit-autofill:focus {
        -webkit-text-fill-color: #fff;
        -webkit-box-shadow: 0 0 0px 1000px #222 inset;
        box-shadow: 0 0 0px 1000px #222 inset;
        transition: background-color 9999s ease-in-out 0s;
    }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);
},

    hideUpgradeScreen() {
        const overlay = document.getElementById('upgrade-overlay');
        if (overlay) overlay.style.display = 'none';
    },

};
