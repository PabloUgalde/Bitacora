const addFlightModal = {

    open: (flightId = null) => {
        const overlay = document.getElementById('add-flight-overlay');
        if (!overlay) return;

        if (!flightId) ui.resetFlightForm();

        document.querySelectorAll('#flight-form .form-step').forEach((step, i) => {
            step.classList.toggle('active', i === 0);
        });

        ui.populateAircraftTypes();
        ui.updateFormForRole();

        const title = document.getElementById('flight-form-title');
        if (title) title.textContent = flightId ? 'Editar Vuelo' : 'Añadir Nuevo Vuelo';

        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    close: () => {
        const overlay = document.getElementById('add-flight-overlay');
        if (!overlay) return;
        overlay.style.display = 'none';
        document.body.style.overflow = '';
        if (logbookState.editingFlightId) ui.resetFlightForm();
    },

    highlightRow: (flightId) => {
        const row = document.getElementById(`flight-${flightId}`);
        if (!row) return;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.style.transition = 'background-color 0.3s ease';
        row.style.backgroundColor = '#2a1e00';
        row.style.outline = '1px solid #c9a84c';
        setTimeout(() => {
            row.style.backgroundColor = '';
            row.style.outline = '';
        }, 2500);
    },
};