// =================================================================
// PROFILE-VALIDATOR.JS
// Normalización y validación de datos del perfil del piloto
// =================================================================

const profileValidator = {

    // ── Lista de países ───────────────────────────────────────────
    COUNTRIES: [
        // Sudamérica primero
        { code: 'CL', name: 'Chile',            prefix: '+56',  docLabel: 'RUT' },
        { code: 'AR', name: 'Argentina',         prefix: '+54',  docLabel: 'DNI' },
        { code: 'BR', name: 'Brasil',            prefix: '+55',  docLabel: 'CPF' },
        { code: 'CO', name: 'Colombia',          prefix: '+57',  docLabel: 'Cédula' },
        { code: 'PE', name: 'Perú',              prefix: '+51',  docLabel: 'DNI' },
        { code: 'VE', name: 'Venezuela',         prefix: '+58',  docLabel: 'Cédula' },
        { code: 'EC', name: 'Ecuador',           prefix: '+593', docLabel: 'Cédula' },
        { code: 'BO', name: 'Bolivia',           prefix: '+591', docLabel: 'CI' },
        { code: 'PY', name: 'Paraguay',          prefix: '+595', docLabel: 'CI' },
        { code: 'UY', name: 'Uruguay',           prefix: '+598', docLabel: 'CI' },
        { code: 'GY', name: 'Guyana',            prefix: '+592', docLabel: 'ID' },
        { code: 'SR', name: 'Surinam',           prefix: '+597', docLabel: 'ID' },
        // Resto del mundo
        { code: 'US', name: 'Estados Unidos',    prefix: '+1',   docLabel: 'Pasaporte' },
        { code: 'MX', name: 'México',            prefix: '+52',  docLabel: 'CURP' },
        { code: 'ES', name: 'España',            prefix: '+34',  docLabel: 'DNI/NIE' },
        { code: 'CA', name: 'Canadá',            prefix: '+1',   docLabel: 'Pasaporte' },
        { code: 'GB', name: 'Reino Unido',       prefix: '+44',  docLabel: 'Pasaporte' },
        { code: 'DE', name: 'Alemania',          prefix: '+49',  docLabel: 'Pasaporte' },
        { code: 'FR', name: 'Francia',           prefix: '+33',  docLabel: 'Pasaporte' },
        { code: 'IT', name: 'Italia',            prefix: '+39',  docLabel: 'Codice Fiscale' },
        { code: 'PT', name: 'Portugal',          prefix: '+351', docLabel: 'NIF' },
        { code: 'AU', name: 'Australia',         prefix: '+61',  docLabel: 'Pasaporte' },
        { code: 'NZ', name: 'Nueva Zelanda',     prefix: '+64',  docLabel: 'Pasaporte' },
        { code: 'JP', name: 'Japón',             prefix: '+81',  docLabel: 'Pasaporte' },
        { code: 'CN', name: 'China',             prefix: '+86',  docLabel: 'Pasaporte' },
        { code: 'ZZ', name: 'Otro',              prefix: '+',    docLabel: 'Documento' },
    ],

    // ── Normalización de nombre ───────────────────────────────────
    // Capitaliza primera letra de cada palabra, preserva mayúsculas intencionales
    normalizeName(value) {
        if (!value) return '';
        return value.split(' ').map(word => {
            if (!word) return '';
            // Si la palabra está toda en mayúsculas (intencional), la preserva
            if (word === word.toUpperCase() && word.length > 1) return word;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');
    },

    // ── Validación y formato de RUT chileno ───────────────────────
    formatRUT(value) {
        // Eliminar todo lo que no sea dígito o K
        let clean = value.replace(/[^0-9kK]/g, '').toUpperCase();
        if (clean.length < 2) return { valid: false, formatted: value, error: 'RUT demasiado corto.' };

        const dv = clean.slice(-1);
        const num = clean.slice(0, -1);

        if (num.length < 7 || num.length > 8) {
            return { valid: false, formatted: value, error: 'RUT inválido.' };
        }

        // Validar dígito verificador
        let sum = 0;
        let mul = 2;
        for (let i = num.length - 1; i >= 0; i--) {
            sum += parseInt(num[i]) * mul;
            mul = mul === 7 ? 2 : mul + 1;
        }
        const expectedDV = 11 - (sum % 11);
        const expectedStr = expectedDV === 11 ? '0' : expectedDV === 10 ? 'K' : String(expectedDV);

        if (dv !== expectedStr) {
            return { valid: false, formatted: value, error: `Dígito verificador inválido. Se esperaba: ${expectedStr}` };
        }

        // Formatear: 12.345.678-9
        const formatted = num.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
        return { valid: true, formatted };
    },

    // ── Normalización de documento de identidad ───────────────────
    normalizeDocument(value) {
        if (!value) return value;
        // Convertir último carácter a mayúsculas si es letra (para K del RUT u otros)
        return value.replace(/-([a-z])$/, (_, c) => '-' + c.toUpperCase());
    },

    // ── Formato de teléfono ───────────────────────────────────────
    formatPhone(value, prefix) {
        if (!value) return '';
        const clean = value.replace(/[^\d]/g, '');
        if (!prefix) return clean;
        if (prefix === '+56' && clean.length === 9 && clean.startsWith('9')) {
            return `${clean[0]} ${clean.slice(1,5)} ${clean.slice(5)}`;
        }
        return clean;
    },

    // ── Validación de email ───────────────────────────────────────
    validateEmail(value) {
        if (!value) return { valid: true, formatted: '' };
        const lower = value.toLowerCase().trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!emailRegex.test(lower)) {
            return { valid: false, formatted: lower, error: 'Email inválido. Debe tener @ y un dominio válido.' };
        }
        return { valid: true, formatted: lower };
    },

    // ── Normalización de dirección ────────────────────────────────
    normalizeAddress(value) {
        if (!value) return '';
        return value.split(' ').map(word => {
            if (!word) return '';
            // Preservar palabras completamente en mayúsculas
            if (word === word.toUpperCase() && word.length > 1 && isNaN(word)) return word;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');
    },

    // ── Obtener datos del país seleccionado ───────────────────────
    getCountry(code) {
        return this.COUNTRIES.find(c => c.code === code) || this.COUNTRIES[0];
    },

    // ── Inicializar formulario de perfil ──────────────────────────
    initProfileForm() {
        const countrySelect = document.getElementById('profile-pais');
        if (!countrySelect) return;

        // Poblar selector de países
        countrySelect.innerHTML = this.COUNTRIES.map(c =>
            `<option value="${c.code}">${c.name}</option>`
        ).join('');

        // Actualizar label del documento al cambiar país
        countrySelect.addEventListener('change', () => {
            profileValidator.updateDocumentLabel();
        });

        // Listeners de normalización en tiempo real
        const nombreInput = document.getElementById('profile-nombre');
        if (nombreInput) {
            nombreInput.addEventListener('blur', () => {
                nombreInput.value = profileValidator.normalizeName(nombreInput.value);
            });
        }

        const emailInput = document.getElementById('profile-email');
        if (emailInput) {
            emailInput.addEventListener('blur', () => {
                const result = profileValidator.validateEmail(emailInput.value);
                emailInput.value = result.formatted;
                profileValidator.setFieldError(emailInput, result.valid ? null : result.error);
            });
        }

        const docInput = document.getElementById('profile-documento');
        if (docInput) {
            docInput.addEventListener('blur', () => {
                const countryCode = countrySelect?.value || 'CL';
                if (countryCode === 'CL') {
                    const result = profileValidator.formatRUT(docInput.value);
                    docInput.value = result.formatted;
                    profileValidator.setFieldError(docInput, result.valid ? null : result.error);
                } else {
                    docInput.value = profileValidator.normalizeDocument(docInput.value);
                }
            });
        }

        // Poblar selector de prefijos
        const telPrefix = document.getElementById('profile-tel-prefix');
        if (telPrefix) {
            telPrefix.innerHTML = this.COUNTRIES.map(c =>
                `<option value="${c.prefix}">${c.name} (${c.prefix})</option>`
            ).join('');
            telPrefix.value = '+56'; // Chile por defecto
        }

        const telInput = document.getElementById('profile-telefono');
        if (telInput) {
            telInput.addEventListener('blur', () => {
                // Solo dígitos y espacios
                let clean = telInput.value.replace(/[^\d]/g, '');
                // Formato chileno: 9 1234 5678
                const prefix = telPrefix?.value || '+56';
                if (prefix === '+56' && clean.length === 9 && clean.startsWith('9')) {
                    clean = `${clean[0]} ${clean.slice(1,5)} ${clean.slice(5)}`;
                }
                telInput.value = clean;
            });
        }

        const domicilioInput = document.getElementById('profile-domicilio');
        if (domicilioInput) {
            domicilioInput.addEventListener('blur', () => {
                domicilioInput.value = profileValidator.normalizeAddress(domicilioInput.value);
            });
        }
    },

    updateDocumentLabel() {
        const countryCode = document.getElementById('profile-pais')?.value || 'CL';
        const country = profileValidator.getCountry(countryCode);
        const label = document.querySelector('label[for="profile-documento"]');
        if (label) label.textContent = country.docLabel;
    },

    setFieldError(input, errorMsg) {
        let errorEl = input.parentElement.querySelector('.field-error');
        if (errorMsg) {
            input.classList.add('error');
            if (!errorEl) {
                errorEl = document.createElement('span');
                errorEl.className = 'field-error';
                input.parentElement.appendChild(errorEl);
            }
            errorEl.textContent = errorMsg;
        } else {
            input.classList.remove('error');
            if (errorEl) errorEl.remove();
        }
    },

    // ── Validar todo el formulario antes de guardar ───────────────
    validateProfileForm() {
        const countryCode = document.getElementById('profile-pais')?.value || 'CL';
        const country = profileValidator.getCountry(countryCode);
        let valid = true;

        // Nombre
        const nombre = document.getElementById('profile-nombre');
        if (nombre) nombre.value = profileValidator.normalizeName(nombre.value);

        // Documento
        const doc = document.getElementById('profile-documento');
        if (doc && doc.value) {
            if (countryCode === 'CL') {
                const result = profileValidator.formatRUT(doc.value);
                doc.value = result.formatted;
                profileValidator.setFieldError(doc, result.valid ? null : result.error);
                if (!result.valid) valid = false;
            } else {
                doc.value = profileValidator.normalizeDocument(doc.value);
            }
        }

        // Email
        const email = document.getElementById('profile-email');
        if (email && email.value) {
            const result = profileValidator.validateEmail(email.value);
            email.value = result.formatted;
            profileValidator.setFieldError(email, result.valid ? null : result.error);
            if (!result.valid) valid = false;
        }

        // Teléfono
        const tel = document.getElementById('profile-telefono');
        if (tel && tel.value) {
            tel.value = profileValidator.formatPhone(tel.value, country.prefix);
        }

        // Domicilio
        const dom = document.getElementById('profile-domicilio');
        if (dom) dom.value = profileValidator.normalizeAddress(dom.value);

        return valid;
    },

    // ── Leer valores del formulario con campo unificado de documento
    getProfileFormData() {
        return {
            pais:     document.getElementById('profile-pais')?.value || 'CL',
            nombre:   document.getElementById('profile-nombre')?.value || '',
            documento: document.getElementById('profile-documento')?.value || '',
            nacimiento: document.getElementById('profile-nacimiento')?.value || '',
            ci:       '', // legacy, ahora usamos 'documento'
            telefono: (document.getElementById('profile-tel-prefix')?.value || '') + ' ' + 
            (document.getElementById('profile-telefono')?.value || ''),
            email:    document.getElementById('profile-email')?.value || '',
            domicilio: document.getElementById('profile-domicilio')?.value || '',
        };
    },
};
