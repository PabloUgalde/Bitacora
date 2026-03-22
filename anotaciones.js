// =================================================================
// ANOTACIONES.JS
// Gestión de Certificaciones, Autorizaciones, Limitaciones y Sanciones
// Tabla: anotaciones (Supabase)
// =================================================================

const anotaciones = {

    _data: [],

    TIPOS: {
        cert: { label: 'Certificación', color: '#378ADD' },
        auth: { label: 'Autorización',  color: '#639922' },
        lim:  { label: 'Limitación',    color: '#BA7517' },
        san:  { label: 'Sanción',       color: '#E24B4A' },
    },

    // ── Cargar desde Supabase ─────────────────────────────────────
    load: async () => {
        if (!supabaseClient || !currentUser) return;
        const { data, error } = await supabaseClient
            .from('anotaciones')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('fecha', { ascending: false });
        if (error) { console.error('Error cargando anotaciones:', error); return; }
        anotaciones._data = data || [];
        anotaciones.render();
    },

    // ── Agregar ───────────────────────────────────────────────────
    add: async () => {
        const fecha = document.getElementById('anot-fecha')?.value;
        const tipo  = document.getElementById('anot-tipo')?.value;
        const texto = document.getElementById('anot-texto')?.value?.trim();

        if (!fecha || !tipo || !texto) {
            ui.showNotification('Completa todos los campos antes de agregar.', 'error');
            return;
        }

        const { data, error } = await supabaseClient
            .from('anotaciones')
            .insert([{ user_id: currentUser.id, fecha, tipo, texto }])
            .select()
            .single();

        if (error) { console.error('Error guardando anotación:', error); ui.showNotification('Error al guardar.', 'error'); return; }

        anotaciones._data.unshift(data);
        document.getElementById('anot-texto').value = '';
        document.getElementById('anot-fecha').value = new Date().toISOString().split('T')[0];
        anotaciones.render();
        ui.showNotification('Anotación guardada.', 'success');
    },

    // ── Eliminar ──────────────────────────────────────────────────
    delete: async (id) => {
        if (!confirm('¿Eliminar esta anotación?')) return;
        const { error } = await supabaseClient
            .from('anotaciones')
            .delete()
            .eq('id', id)
            .eq('user_id', currentUser.id);
        if (error) { ui.showNotification('Error al eliminar.', 'error'); return; }
        anotaciones._data = anotaciones._data.filter(a => a.id !== id);
        anotaciones.render();
        ui.showNotification('Anotación eliminada.', 'success');
    },

    // ── Render ────────────────────────────────────────────────────
    render: () => {
        const container = document.querySelector('#view-anotaciones .anot-wrap');
        if (!container) return;

        const grupos = { cert: [], auth: [], lim: [], san: [] };
        anotaciones._data.forEach(a => { if (grupos[a.tipo]) grupos[a.tipo].push(a); });

        const formatFecha = (f) => {
            const [y, m, d] = f.split('-');
            return `${d}/${m}/${y}`;
        };

        const renderGrupo = (tipo) => {
            const t = anotaciones.TIPOS[tipo];
            const items = grupos[tipo];
            const rows = items.length === 0
                ? `<div class="anot-empty">Sin ${t.label.toLowerCase()}s registradas.</div>`
                : items.map(a => `
                    <div class="anot-entry">
                        <span class="anot-fecha">${formatFecha(a.fecha)}</span>
                        <span class="anot-texto">${a.texto}</span>
                        <button class="anot-del" onclick="anotaciones.delete('${a.id}')" title="Eliminar">×</button>
                    </div>`).join('');
            return `
                <div class="anot-group">
                    <div class="anot-group-title" style="color:${t.color}">${t.label.toUpperCase()}S</div>
                    ${rows}
                </div>`;
        };

        container.innerHTML = `
            <div class="anot-wrap">
                <div class="anot-header">
                    <div>
                        <h2 class="anot-title">Anotaciones de Bitácora</h2>
                        <p class="anot-subtitle">Certificaciones · Autorizaciones · Limitaciones · Sanciones</p>
                    </div>
                </div>

                <div class="anot-form">
                    <div class="anot-form-row">
                        <div class="anot-field">
                            <label>Fecha</label>
                            <input type="date" id="anot-fecha" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="anot-field">
                            <label>Tipo</label>
                            <select id="anot-tipo">
                                <option value="cert">Certificación</option>
                                <option value="auth">Autorización</option>
                                <option value="lim">Limitación</option>
                                <option value="san">Sanción</option>
                            </select>
                        </div>
                        <div class="anot-field anot-field-full">
                            <label>Anotación</label>
                            <input type="text" id="anot-texto" 
                                placeholder="Ej: Queda habilitado para vuelo nocturno. 4 aterrizajes SCPD. Instructor J. Pérez Lic. 12345"
                                onkeydown="if(event.key==='Enter') anotaciones.add()">
                        </div>
                    </div>
                    <div class="anot-form-actions">
                        <button class="anot-btn-add" onclick="anotaciones.add()">+ Agregar anotación</button>
                    </div>
                </div>

                ${renderGrupo('cert')}
                ${renderGrupo('auth')}
                ${renderGrupo('lim')}
                ${renderGrupo('san')}
            </div>`;
    },

    // ── Inyectar estilos ──────────────────────────────────────────
    injectStyles: () => {
        if (document.getElementById('anot-styles')) return;
        const style = document.createElement('style');
        style.id = 'anot-styles';
        style.textContent = `
        .anot-wrap { padding: 8px 24px 24px; max-width: 900px; margin: 0 auto; }
        .anot-header { margin-top: 0; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color, #222); }
        .anot-title { font-size: 20px; font-weight: 700; color: var(--text-primary, #fff); margin-bottom: 4px; }
        .anot-subtitle { font-size: 13px; color: var(--text-secondary, #666); }
        .anot-form { background: var(--card-bg, #1a1a1a); border: 1px solid var(--border-color, #222); border-radius: 10px; padding: 16px; margin-bottom: 24px; }
        .anot-form-row { display: grid; grid-template-columns: 150px 160px 1fr; gap: 10px; align-items: end; }
        .anot-field label { display: block; font-size: 11px; color: var(--text-secondary, #666); margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
        .anot-field input, .anot-field select { width: 100%; padding: 8px 12px; background: var(--input-bg, #111); border: 1px solid var(--border-color, #333); border-radius: 6px; color: var(--text-primary, #fff); font-size: 13px; outline: none; box-sizing: border-box; }
        .anot-field input:focus, .anot-field select:focus { border-color: var(--accent-color, #c9a84c); }
        .anot-field-full { grid-column: 1 / -1; }
        .anot-form-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
        .anot-btn-add { background: var(--accent-color, #c9a84c); color: #000; border: none; border-radius: 6px; padding: 8px 20px; font-size: 13px; font-weight: 700; cursor: pointer; transition: opacity 0.2s; }
        .anot-btn-add:hover { opacity: 0.85; }
        .anot-group { margin-bottom: 24px; }
        .anot-group-title { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; margin-bottom: 8px; padding-left: 2px; }
        .anot-entry { background: var(--card-bg, #1a1a1a); border: 1px solid var(--border-color, #222); border-radius: 8px; padding: 10px 14px; margin-bottom: 6px; display: flex; align-items: flex-start; gap: 12px; transition: border-color 0.15s; }
        .anot-entry:hover { border-color: #333; }
        .anot-fecha { font-size: 12px; color: var(--text-secondary, #666); white-space: nowrap; min-width: 76px; padding-top: 1px; font-family: monospace; }
        .anot-texto { font-size: 13px; color: var(--text-primary, #ccc); line-height: 1.5; flex: 1; }
        .anot-del { background: transparent; border: none; color: #444; font-size: 18px; cursor: pointer; padding: 0 2px; line-height: 1; transition: color 0.15s; }
        .anot-del:hover { color: #c05050; }
        .anot-empty { font-size: 13px; color: var(--text-secondary, #555); font-style: italic; padding: 8px 2px; }
        @media (max-width: 600px) {
            .anot-form-row { grid-template-columns: 1fr 1fr; }
            .anot-field-full { grid-column: 1 / -1; }
            .anot-wrap { padding: 16px; }
        }`;
        document.head.appendChild(style);
    }
};
