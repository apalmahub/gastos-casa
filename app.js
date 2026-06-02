/* ==========================================================================
   Finanzas Familiares - Lógica de Negocio y UI (app.js)
   ========================================================================== */

// --- 1. Inicialización y Estado de la Aplicación ---
let state = {
    transactions: [],
    members: {
        m1: { name: 'Miembro 1', enabled: true },
        m2: { name: 'Miembro 2', enabled: true },
        m3: { name: 'Miembro 3', enabled: false }
    },
    categories: [
        '🏠 Vivienda',
        '🍎 Alimentación',
        '💡 Servicios',
        '🚗 Transporte',
        '🍿 Ocio',
        '🩺 Salud',
        '🎓 Educación',
        '🛍️ Compras',
        '🔄 Otros'
    ],
    activeTab: 'dashboard'
};

// Instancias de Gráficos (Chart.js)
let categoryChartInstance = null;
let memberChartInstance = null;

// Datos Semilla (Para que no esté vacía en el primer inicio)
const seedData = {
    transactions: [],
    members: {
        m1: { name: 'Alvaro', enabled: true },
        m2: { name: 'Bety', enabled: true },
        m3: { name: 'Carlos', enabled: false }
    },
    categories: [
        '🏠 Vivienda',
        '🍎 Alimentación',
        '💡 Servicios',
        '🚗 Transporte',
        '🍿 Ocio',
        '🩺 Salud',
        '🎓 Educación',
        '🛍️ Compras',
        '🔄 Otros'
    ]
};

// Auxiliar para generar fechas relativas al día de hoy
function getOffsetDate(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
}

// --- 2. Carga Inicial y Sincronización ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    initApp();
    setupEventListeners();
    showToast('¡Bienvenido a FamiliaFin!', 'info');
});

// Cargar estado de LocalStorage o usar semillas si no existe
function loadState() {
    const savedState = localStorage.getItem('familiafin_state');
    if (savedState) {
        try {
            state = JSON.parse(savedState);
            // Asegurar retrocompatibilidad si alguna estructura cambió
            if (!state.transactions) {
                state.transactions = [];
            } else {
                // Eliminar transacciones semilla automáticas previas para empezar limpio
                state.transactions = state.transactions.filter(t => !t.id.startsWith('seed-'));
            }
            if (!state.categories) state.categories = [...seedData.categories];
            if (!state.members) {
                state.members = { ...seedData.members };
            } else {
                // Migrar nombres antiguos (Juan -> Alvaro, María -> Bety) si están presentes
                if (state.members.m1 && (state.members.m1.name === 'Juan' || state.members.m1.name === 'Miembro 1')) {
                    state.members.m1.name = 'Alvaro';
                }
                if (state.members.m2 && (state.members.m2.name === 'María' || state.members.m2.name === 'Mar\u00EDa' || state.members.m2.name === 'Miembro 2')) {
                    state.members.m2.name = 'Bety';
                }
            }
            saveState();
        } catch (e) {
            console.error('Error al cargar datos. Cargando datos por defecto.', e);
            state = { ...seedData };
        }
    } else {
        // Carga de datos demo la primera vez
        state = {
            transactions: [...seedData.transactions],
            members: { ...seedData.members },
            categories: [...seedData.categories],
            activeTab: 'dashboard'
        };
        saveState();
    }
}

// Guardar el estado en LocalStorage
function saveState() {
    localStorage.setItem('familiafin_state', JSON.stringify(state));
}

// --- 3. Inicialización del DOM y Controles ---
function initApp() {
    // Configurar fecha del día por defecto en el modal
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
    
    // Dibujar interfaz
    updateUIElements();
    renderAll();
    
    // Inicializar Iconos Lucide
    lucide.createIcons();
}

// Actualizar textos y selectores dinámicos en el DOM según la configuración de miembros
function updateUIElements() {
    const m1 = state.members.m1;
    const m2 = state.members.m2;
    const m3 = state.members.m3;

    // Actualizar avatares laterales
    document.getElementById('avatar-1').innerText = m1.name.slice(0,2).toUpperCase();
    document.getElementById('avatar-2').innerText = m2.name.slice(0,2).toUpperCase();
    
    if (m3.enabled) {
        document.getElementById('avatar-3').innerText = m3.name.slice(0,2).toUpperCase();
        document.getElementById('avatar-3').classList.remove('hidden');
        document.getElementById('member-count-text').innerText = '3 Integrantes';
    } else {
        document.getElementById('avatar-3').classList.add('hidden');
        document.getElementById('member-count-text').innerText = '2 Integrantes';
    }

    // Actualizar nombres en los selectores de filtros
    document.getElementById('filter-opt-m1').innerText = m1.name;
    document.getElementById('filter-opt-m2').innerText = m2.name;
    
    // Actualizar nombres en los selectores del modal de transacción
    document.getElementById('modal-opt-m1').innerText = m1.name;
    document.getElementById('modal-opt-m2').innerText = m2.name;

    // Aportantes en Reportes
    document.getElementById('report-opt-m1').innerText = m1.name;
    document.getElementById('report-opt-m2').innerText = m2.name;

    if (m3.enabled) {
        document.getElementById('filter-opt-m3').classList.remove('hidden');
        document.getElementById('filter-opt-m3').innerText = m3.name;
        document.getElementById('modal-opt-m3').classList.remove('hidden');
        document.getElementById('modal-opt-m3').innerText = m3.name;
        document.getElementById('report-opt-m3').classList.remove('hidden');
        document.getElementById('report-opt-m3').innerText = m3.name;
    } else {
        document.getElementById('filter-opt-m3').classList.add('hidden');
        document.getElementById('modal-opt-m3').classList.add('hidden');
        document.getElementById('report-opt-m3').classList.add('hidden');
    }

    // Actualizar el selector de categorías en filtros y modales
    populateCategorySelectors();
}

// Cargar categorías en desplegables
function populateCategorySelectors() {
    const filterCat = document.getElementById('filter-category');
    const modalCat = document.getElementById('trans-category');

    // Guardar selecciones actuales
    const currentFilterVal = filterCat.value;
    const currentModalVal = modalCat.value;

    // Limpiar excepto el "Todos" en filtros
    filterCat.innerHTML = '<option value="all">Todas</option>';
    modalCat.innerHTML = '';

    state.categories.forEach(cat => {
        // En filtros
        const optFilter = document.createElement('option');
        optFilter.value = cat;
        optFilter.innerText = cat;
        filterCat.appendChild(optFilter);

        // En modal
        const optModal = document.createElement('option');
        optModal.value = cat;
        optModal.innerText = cat;
        modalCat.appendChild(optModal);
    });

    // Restaurar selecciones si aún existen en la lista
    if (state.categories.includes(currentFilterVal)) filterCat.value = currentFilterVal;
    if (state.categories.includes(currentModalVal)) modalCat.value = currentModalVal;
}

// --- 4. Renderizado Central ---
function renderAll() {
    renderDashboard();
    renderTransactionsTable();
    renderSettings();
    renderPDFPreview();
}

// Renderizado: Panel Dashboard Principal
function renderDashboard() {
    let totalIncomes = 0;
    let totalExpenses = 0;
    
    // Diccionarios para acumular datos por miembro
    const memberData = {
        '1': { income: 0, expense: 0 },
        '2': { income: 0, expense: 0 },
        '3': { income: 0, expense: 0 }
    };

    // Diccionario para acumular gastos por categoría
    const categoryExpenses = {};
    state.categories.forEach(cat => categoryExpenses[cat] = 0);

    // Calcular balances y estadísticas
    state.transactions.forEach(t => {
        const amt = parseFloat(t.amount);
        if (t.type === 'income') {
            totalIncomes += amt;
            if (memberData[t.memberId]) {
                memberData[t.memberId].income += amt;
            }
        } else {
            totalExpenses += amt;
            if (memberData[t.memberId]) {
                memberData[t.memberId].expense += amt;
            }
            // Agrupar categorías (asegurando que exista)
            const cat = t.category || 'Otros';
            if (categoryExpenses[cat] !== undefined) {
                categoryExpenses[cat] += amt;
            } else {
                categoryExpenses[cat] = amt;
            }
        }
    });

    const netBalance = totalIncomes - totalExpenses;

    // Actualizar tarjetas de métricas superiores
    document.getElementById('balance-neto').innerText = formatCurrency(netBalance);
    document.getElementById('total-ingresos').innerText = formatCurrency(totalIncomes);
    document.getElementById('total-gastos').innerText = formatCurrency(totalExpenses);

    // Cantidades
    const incomesCount = state.transactions.filter(t => t.type === 'income').length;
    const expensesCount = state.transactions.filter(t => t.type === 'expense').length;
    document.getElementById('ingresos-count').innerHTML = `<span>${incomesCount} entradas</span>`;
    document.getElementById('gastos-count').innerHTML = `<span>${expensesCount} salidas</span>`;

    // Estado del balance familiar
    const statusEl = document.getElementById('balance-status');
    if (netBalance >= 0) {
        statusEl.className = 'metric-footer text-success';
        statusEl.innerHTML = '<i data-lucide="trending-up"></i><span>Finanzas Saludables</span>';
    } else {
        statusEl.className = 'metric-footer text-danger';
        statusEl.innerHTML = '<i data-lucide="trending-down"></i><span>Déficit Familiar (Gastos exceden ingresos)</span>';
    }

    // Dibujar tarjetas de Integrantes Dinámicas
    const contributorsContainer = document.getElementById('contributors-cards-container');
    contributorsContainer.innerHTML = '';

    const activeMemberIds = ['1', '2'];
    if (state.members.m3.enabled) activeMemberIds.push('3');

    activeMemberIds.forEach(id => {
        const memberInfo = state.members[`m${id}`];
        const mIncome = memberData[id].income;
        const mExpense = memberData[id].expense;
        
        // Calcular porcentaje del aporte total al pozo común
        const totalIncomePool = totalIncomes || 1; // evitar division por cero
        const contributionPct = Math.round((mIncome / totalIncomePool) * 100);

        const card = document.createElement('div');
        card.className = `contributor-card m${id}`;
        card.innerHTML = `
            <div class="contributor-card-header">
                <span class="contributor-name">${memberInfo.name}</span>
                <span class="contributor-ratio">${contributionPct}% del pozo</span>
            </div>
            <div class="contributor-stats-row">
                <div class="c-stat">
                    <span class="c-stat-lbl">Ha Aportado</span>
                    <span class="c-stat-val income">${formatCurrency(mIncome)}</span>
                </div>
                <div class="c-stat">
                    <span class="c-stat-lbl">Ha Gastado</span>
                    <span class="c-stat-val expense">${formatCurrency(mExpense)}</span>
                </div>
            </div>
            <div class="contributor-net-row">
                <div class="net-indicator-label">
                    <span>Flujo Neto</span>
                    <span>${formatCurrency(mIncome - mExpense)}</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${Math.min(Math.max((mIncome / (mIncome + mExpense || 1)) * 100, 0), 100)}%"></div>
                </div>
            </div>
        `;
        contributorsContainer.appendChild(card);
    });

    // Renderizar Gráficos
    renderCharts(categoryExpenses, memberData);

    // Renderizar Últimas Operaciones (solo las 5 más recientes)
    const recentTbody = document.getElementById('recent-transactions-tbody');
    recentTbody.innerHTML = '';
    
    const sortedTransactions = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent5 = sortedTransactions.slice(0, 5);

    if (recent5.length === 0) {
        recentTbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No hay transacciones registradas aún. Haz clic en "Nueva Operación" para empezar.</td></tr>`;
    } else {
        recent5.forEach(t => {
            const memberInfo = state.members[`m${t.memberId}`];
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatDate(t.date)}</td>
                <td>
                    <span class="member-chip m${t.memberId}">
                        <span class="member-chip-dot"></span>
                        ${memberInfo ? memberInfo.name : 'Desconocido'}
                    </span>
                </td>
                <td>
                    <span class="badge-type ${t.type}">
                        ${t.type === 'income' ? 'Entrada' : 'Salida'}
                    </span>
                </td>
                <td><span class="category-tag">${t.type === 'income' ? 'Ingreso' : t.category}</span></td>
                <td>${escapeHTML(t.description)}</td>
                <td class="amount-col ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</td>
                <td class="actions-col">
                    <div class="actions-cell">
                        <button class="btn-icon edit" onclick="openEditModal('${t.id}')" title="Editar">
                            <i data-lucide="edit-3"></i>
                        </button>
                        <button class="btn-icon delete" onclick="confirmDeleteTransaction('${t.id}')" title="Eliminar">
                            <i data-lucide="trash"></i>
                        </button>
                    </div>
                </td>
            `;
            recentTbody.appendChild(row);
        });
    }

    lucide.createIcons();
}

// Renderizar Gráficos vía Chart.js
function renderCharts(categoryExpenses, memberData) {
    // 1. Gráfico de Categorías (Dona)
    const catCanvas = document.getElementById('categoryChart');
    if (!catCanvas) return;

    const catLabels = Object.keys(categoryExpenses).filter(cat => categoryExpenses[cat] > 0);
    const catValues = catLabels.map(cat => categoryExpenses[cat]);

    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    if (catValues.length === 0) {
        // Sin datos
        const ctx = catCanvas.getContext('2d');
        ctx.clearRect(0, 0, catCanvas.width, catCanvas.height);
        categoryChartInstance = null;
    } else {
        categoryChartInstance = new Chart(catCanvas, {
            type: 'doughnut',
            data: {
                labels: catLabels,
                datasets: [{
                    data: catValues,
                    backgroundColor: [
                        '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', 
                        '#10b981', '#f59e0b', '#06b6d4', '#14b8a6', '#6b7280'
                    ],
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.06)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#475569',
                            font: { family: 'Plus Jakarta Sans', size: 11 }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    // 2. Gráfico de Comparación de Integrantes (Barras)
    const memberCanvas = document.getElementById('memberComparisonChart');
    if (!memberCanvas) return;

    const mLabels = [];
    const mIncomes = [];
    const mExpenses = [];

    const activeMemberIds = ['1', '2'];
    if (state.members.m3.enabled) activeMemberIds.push('3');

    activeMemberIds.forEach(id => {
        const info = state.members[`m${id}`];
        mLabels.push(info.name);
        mIncomes.push(memberData[id].income);
        mExpenses.push(memberData[id].expense);
    });

    if (memberChartInstance) {
        memberChartInstance.destroy();
    }

    memberChartInstance = new Chart(memberCanvas, {
        type: 'bar',
        data: {
            labels: mLabels,
            datasets: [
                {
                    label: 'Aportes (Ingresos)',
                    data: mIncomes,
                    backgroundColor: 'rgba(16, 185, 129, 0.75)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Gastos (Salidas)',
                    data: mExpenses,
                    backgroundColor: 'rgba(244, 63, 94, 0.75)',
                    borderColor: '#f43f5e',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#475569',
                        font: { family: 'Plus Jakarta Sans', size: 11 }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#475569', font: { family: 'Plus Jakarta Sans' } }
                },
                y: {
                    grid: { color: 'rgba(14, 165, 233, 0.08)' },
                    ticks: { color: '#475569', font: { family: 'Plus Jakarta Sans' } }
                }
            }
        }
    });
}

// Renderizado: Tabla Principal de Transacciones
function renderTransactionsTable() {
    const tbody = document.getElementById('all-transactions-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Obtener filtros activos
    const searchVal = document.getElementById('search-description').value.toLowerCase().trim();
    const typeVal = document.getElementById('filter-type').value;
    const memberVal = document.getElementById('filter-member').value;
    const categoryVal = document.getElementById('filter-category').value;
    const dateVal = document.getElementById('filter-date').value;

    // Aplicar filtros a la lista completa
    const filtered = state.transactions.filter(t => {
        // Filtro buscador
        if (searchVal && !t.description.toLowerCase().includes(searchVal)) return false;
        
        // Filtro Tipo
        if (typeVal !== 'all' && t.type !== typeVal) return false;

        // Filtro Integrante
        if (memberVal !== 'all' && t.memberId !== memberVal) return false;

        // Filtro Categoría
        if (categoryVal !== 'all') {
            if (t.type === 'income' && categoryVal !== 'Otros') return false; // Incomes no tienen categoria real
            if (t.type === 'expense' && t.category !== categoryVal) return false;
        }

        // Filtro Período
        if (dateVal !== 'all') {
            const tDate = t.date; // string YYYY-MM-DD
            const nowObj = new Date();
            const year = nowObj.getFullYear();
            const month = String(nowObj.getMonth() + 1).padStart(2, '0');
            
            if (dateVal === 'this-month') {
                if (!tDate.startsWith(`${year}-${month}`)) return false;
            } else if (dateVal === 'last-month') {
                const prevMonthObj = new Date(nowObj.getFullYear(), nowObj.getMonth() - 1, 1);
                const pYear = prevMonthObj.getFullYear();
                const pMonth = String(prevMonthObj.getMonth() + 1).padStart(2, '0');
                if (!tDate.startsWith(`${pYear}-${pMonth}`)) return false;
            } else if (dateVal === 'last-30') {
                const limitDate = new Date();
                limitDate.setDate(limitDate.getDate() - 30);
                const limitStr = limitDate.toISOString().split('T')[0];
                if (tDate < limitStr) return false;
            } else if (dateVal === 'custom') {
                const startVal = document.getElementById('filter-date-start').value;
                const endVal = document.getElementById('filter-date-end').value;
                if (startVal && tDate < startVal) return false;
                if (endVal && tDate > endVal) return false;
            }
        }

        return true;
    });

    // Ordenar de más reciente a más antigua
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calcular etiqueta del período activo
    let periodText = 'Todo el Historial';
    if (dateVal === 'this-month') {
        periodText = 'Este Mes';
    } else if (dateVal === 'last-month') {
        periodText = 'Mes Anterior';
    } else if (dateVal === 'last-30') {
        periodText = 'Últimos 30 días';
    } else if (dateVal === 'custom') {
        const startVal = document.getElementById('filter-date-start').value;
        const endVal = document.getElementById('filter-date-end').value;
        if (startVal && endVal) {
            periodText = `${formatDate(startVal)} al ${formatDate(endVal)}`;
        } else if (startVal) {
            periodText = `Desde ${formatDate(startVal)}`;
        } else if (endVal) {
            periodText = `Hasta ${formatDate(endVal)}`;
        } else {
            periodText = 'Rango Personalizado';
        }
    }

    // Contador informativo con insignia de período
    document.getElementById('table-pagination-info').innerHTML = `
        <span>Mostrando <strong>${filtered.length}</strong> de <strong>${state.transactions.length}</strong> transacciones registradas.</span>
        <span class="period-badge-indicator" style="margin-left: auto;">
            <i data-lucide="calendar" style="width: 12px; height: 12px; margin-right: 6px;"></i>
            Período: ${periodText}
        </span>
    `;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-5">Ninguna transacción coincide con los filtros aplicados.</td></tr>`;
        return;
    }

    filtered.forEach(t => {
        const memberInfo = state.members[`m${t.memberId}`];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(t.date)}</td>
            <td>
                <span class="member-chip m${t.memberId}">
                    <span class="member-chip-dot"></span>
                    ${memberInfo ? memberInfo.name : 'Desconocido'}
                </span>
            </td>
            <td>
                <span class="badge-type ${t.type}">
                    ${t.type === 'income' ? 'Entrada' : 'Salida'}
                </span>
            </td>
            <td><span class="category-tag">${t.type === 'income' ? 'Ingreso' : t.category}</span></td>
            <td class="font-medium">${escapeHTML(t.description)}</td>
            <td class="text-muted text-xs">${escapeHTML(t.notes || '-')}</td>
            <td class="amount-col ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</td>
            <td class="actions-col">
                <div class="actions-cell">
                    <button class="btn-icon edit" onclick="openEditModal('${t.id}')" title="Editar">
                        <i data-lucide="edit-3"></i>
                    </button>
                    <button class="btn-icon delete" onclick="confirmDeleteTransaction('${t.id}')" title="Eliminar">
                        <i data-lucide="trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    lucide.createIcons();
}

// Renderizado: Panel Configuración
function renderSettings() {
    // 1. Integrantes Formulario
    document.getElementById('m1-name').value = state.members.m1.name;
    document.getElementById('m2-name').value = state.members.m2.name;
    
    const m3Enabled = state.members.m3.enabled;
    const m3Check = document.getElementById('m3-enabled');
    const m3Input = document.getElementById('m3-name');
    const m3Wrapper = document.getElementById('m3-input-wrapper');

    m3Check.checked = m3Enabled;
    m3Input.value = state.members.m3.name;
    
    if (m3Enabled) {
        m3Input.disabled = false;
        m3Wrapper.classList.remove('disabled');
    } else {
        m3Input.disabled = true;
        m3Wrapper.classList.add('disabled');
    }

    // 2. Editor de Categorías
    const catListEditor = document.getElementById('categories-editor-list');
    catListEditor.innerHTML = '';

    state.categories.forEach(cat => {
        const tag = document.createElement('span');
        tag.className = 'category-edit-tag';
        tag.innerHTML = `
            <span>${cat}</span>
            <button type="button" class="btn-delete-cat" onclick="removeCategory('${cat}')" title="Eliminar Categoría">
                <i data-lucide="x"></i>
            </button>
        `;
        catListEditor.appendChild(tag);
    });

    lucide.createIcons();
}

// Renderizado: Previsualización en Vivo de Reporte PDF
function renderPDFPreview() {
    const previewTitle = document.getElementById('pdf-preview-title');
    const previewIngresos = document.getElementById('pdf-preview-ingresos');
    const previewGastos = document.getElementById('pdf-preview-gastos');
    const previewBalance = document.getElementById('pdf-preview-balance');
    const previewDate = document.getElementById('pdf-date-view');
    const previewPeriod = document.getElementById('pdf-period-view');
    const previewMembersTable = document.getElementById('pdf-preview-members-table').querySelector('tbody');
    const previewCatList = document.getElementById('pdf-preview-categories-list');

    // Cargar título personalizado
    const customTitle = document.getElementById('report-title').value || 'Reporte de Gastos Familiares';
    previewTitle.innerText = customTitle;

    // Fecha actual
    previewDate.innerText = `Fecha: ${formatDate(new Date().toISOString().split('T')[0])}`;

    // Obtener parámetros de filtro para el reporte
    const reportPeriod = document.getElementById('report-period').value;
    const reportMemberId = document.getElementById('report-contributor').value;

    let periodLabel = 'Todo el Historial';
    if (reportPeriod === 'this-month') periodLabel = 'Mes Actual';
    if (reportPeriod === 'last-month') periodLabel = 'Mes Anterior';
    if (reportPeriod === 'custom') {
        const startVal = document.getElementById('report-date-start').value;
        const endVal = document.getElementById('report-date-end').value;
        periodLabel = `Rango: ${startVal ? formatDate(startVal) : '...' } al ${endVal ? formatDate(endVal) : '...'}`;
    }
    previewPeriod.innerText = `Período: ${periodLabel}`;

    // Filtrar transacciones para el cálculo del reporte
    const repTrans = state.transactions.filter(t => {
        // Filtrar Integrante
        if (reportMemberId !== 'all' && t.memberId !== reportMemberId) return false;

        // Filtrar Período
        const tDate = t.date;
        const nowObj = new Date();
        const year = nowObj.getFullYear();
        const month = String(nowObj.getMonth() + 1).padStart(2, '0');

        if (reportPeriod === 'this-month') {
            if (!tDate.startsWith(`${year}-${month}`)) return false;
        } else if (reportPeriod === 'last-month') {
            const prevMonthObj = new Date(nowObj.getFullYear(), nowObj.getMonth() - 1, 1);
            const pYear = prevMonthObj.getFullYear();
            const pMonth = String(prevMonthObj.getMonth() + 1).padStart(2, '0');
            if (!tDate.startsWith(`${pYear}-${pMonth}`)) return false;
        } else if (reportPeriod === 'custom') {
            const startVal = document.getElementById('report-date-start').value;
            const endVal = document.getElementById('report-date-end').value;
            if (startVal && tDate < startVal) return false;
            if (endVal && tDate > endVal) return false;
        }

        return true;
    });

    // Calcular montos acumulados para reporte
    let incomesSum = 0;
    let expensesSum = 0;
    const memberSum = { '1': { inc: 0, exp: 0 }, '2': { inc: 0, exp: 0 }, '3': { inc: 0, exp: 0 } };
    const catSum = {};
    state.categories.forEach(cat => catSum[cat] = 0);

    repTrans.forEach(t => {
        const amt = parseFloat(t.amount);
        if (t.type === 'income') {
            incomesSum += amt;
            if (memberSum[t.memberId]) memberSum[t.memberId].inc += amt;
        } else {
            expensesSum += amt;
            if (memberSum[t.memberId]) memberSum[t.memberId].exp += amt;
            
            const cat = t.category || 'Otros';
            if (catSum[cat] !== undefined) catSum[cat] += amt;
        }
    });

    // Cargar métricas en vista previa
    previewIngresos.innerText = formatCurrency(incomesSum);
    previewGastos.innerText = formatCurrency(expensesSum);
    
    const bal = incomesSum - expensesSum;
    previewBalance.innerText = formatCurrency(bal);
    previewBalance.className = `pdf-m-val ${bal >= 0 ? 'text-success' : 'text-danger'}`;

    // Cargar resumen de miembros en vista previa
    previewMembersTable.innerHTML = '';
    const activeMemberIds = ['1', '2'];
    if (state.members.m3.enabled) activeMemberIds.push('3');

    activeMemberIds.forEach(id => {
        const mInfo = state.members[`m${id}`];
        const row = document.createElement('tr');
        const net = memberSum[id].inc - memberSum[id].exp;
        row.innerHTML = `
            <td style="font-weight:700;">${mInfo.name}</td>
            <td style="color:#10b981;">${formatCurrency(memberSum[id].inc)}</td>
            <td style="color:#ef4444;">${formatCurrency(memberSum[id].exp)}</td>
            <td style="font-weight:700; color:${net >= 0 ? '#10b981' : '#ef4444'};">${formatCurrency(net)}</td>
        `;
        previewMembersTable.appendChild(row);
    });

    // Cargar categorías en vista previa
    previewCatList.innerHTML = '';
    const activeCats = Object.keys(catSum).filter(c => catSum[c] > 0);

    if (activeCats.length === 0) {
        previewCatList.innerHTML = `<span class="text-muted text-xs" style="grid-column: 1 / -1;">No hay gastos registrados en este período.</span>`;
    } else {
        activeCats.forEach(cat => {
            const div = document.createElement('div');
            div.className = 'pdf-cat-row';
            div.innerHTML = `
                <span class="pdf-cat-name">${cat}</span>
                <span class="pdf-cat-val">${formatCurrency(catSum[cat])}</span>
            `;
            previewCatList.appendChild(div);
        });
    }
}

// --- 5. Operaciones CRUD (Transacciones) ---

// Abrir Modal de Registro (Modo Creación)
function openCreateModal() {
    const form = document.getElementById('transaction-form');
    form.reset();
    
    // Configurar campos por defecto
    document.getElementById('edit-transaction-id').value = '';
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-title').innerText = 'Registrar Nueva Operación';
    document.getElementById('btn-save-transaction').innerText = 'Guardar Registro';

    // Asegurar que el toggle esté visualmente al día
    document.getElementById('type-expense').checked = true;
    document.getElementById('category-group').style.display = 'flex';
    document.getElementById('trans-category').required = true;

    // Mostrar overlay
    document.getElementById('transaction-modal').classList.add('active');
}

// Abrir Modal de Registro (Modo Edición)
window.openEditModal = function(id) {
    const t = state.transactions.find(item => item.id === id);
    if (!t) return;

    const form = document.getElementById('transaction-form');
    form.reset();

    // Rellenar campos del formulario
    document.getElementById('edit-transaction-id').value = t.id;
    document.getElementById('trans-amount').value = t.amount;
    document.getElementById('trans-date').value = t.date;
    document.getElementById('trans-member').value = t.memberId;
    document.getElementById('trans-desc').value = t.description;
    document.getElementById('trans-notes').value = t.notes || '';

    // Configurar tipo de transacción
    if (t.type === 'income') {
        document.getElementById('type-income').checked = true;
        document.getElementById('category-group').style.display = 'none';
        document.getElementById('trans-category').required = false;
    } else {
        document.getElementById('type-expense').checked = true;
        document.getElementById('category-group').style.display = 'flex';
        document.getElementById('trans-category').value = t.category;
        document.getElementById('trans-category').required = true;
    }

    // Configurar títulos de modal
    document.getElementById('modal-title').innerText = 'Editar Registro de Operación';
    document.getElementById('btn-save-transaction').innerText = 'Actualizar Cambios';

    // Mostrar modal
    document.getElementById('transaction-modal').classList.add('active');
};

// Cerrar Modal
function closeTransactionModal() {
    document.getElementById('transaction-modal').classList.remove('active');
}

// Confirmar Borrado de Transacción
window.confirmDeleteTransaction = function(id) {
    if (confirm('¿Estás seguro de que deseas eliminar esta operación? Esto afectará los balances generales.')) {
        deleteTransaction(id);
    }
};

// Borrar Transacción
function deleteTransaction(id) {
    state.transactions = state.transactions.filter(item => item.id !== id);
    saveState();
    renderAll();
    showToast('La operación fue eliminada con éxito.', 'success');
}

// Guardar/Actualizar Transacción (Form Submission)
function handleTransactionFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('edit-transaction-id').value;
    const type = document.querySelector('input[name="transaction-type"]:checked').value;
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const date = document.getElementById('trans-date').value;
    const memberId = document.getElementById('trans-member').value;
    const description = document.getElementById('trans-desc').value.trim();
    const notes = document.getElementById('trans-notes').value.trim();
    
    let category = '';
    if (type === 'expense') {
        category = document.getElementById('trans-category').value;
    } else {
        category = 'Otros'; // Ingresos no se asocian obligatoriamente a una de egresos
    }

    if (isNaN(amount) || amount <= 0) {
        showToast('Por favor, ingresa un monto válido superior a cero.', 'danger');
        return;
    }

    if (!description) {
        showToast('Por favor, describe brevemente el motivo de la operación.', 'danger');
        return;
    }

    if (id) {
        // ACTUALIZAR (EDIT)
        const tIndex = state.transactions.findIndex(item => item.id === id);
        if (tIndex !== -1) {
            state.transactions[tIndex] = {
                ...state.transactions[tIndex],
                type,
                amount,
                date,
                memberId,
                category,
                description,
                notes
            };
            showToast('Operación actualizada correctamente.', 'success');
        }
    } else {
        // CREAR (NUEVO)
        const newTransaction = {
            id: 't-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            type,
            amount,
            date,
            memberId,
            category,
            description,
            notes
        };
        state.transactions.push(newTransaction);
        showToast('Nueva operación registrada con éxito.', 'success');
    }

    saveState();
    closeTransactionModal();
    renderAll();
}

// --- 6. Manejo de Configuración ---

// Guardar nombres de los integrantes
function handleMembersFormSubmit(e) {
    e.preventDefault();

    const m1Name = document.getElementById('m1-name').value.trim();
    const m2Name = document.getElementById('m2-name').value.trim();
    const m3Name = document.getElementById('m3-name').value.trim();
    const m3Enabled = document.getElementById('m3-enabled').checked;

    if (!m1Name || !m2Name) {
        showToast('Los primeros dos integrantes son obligatorios.', 'danger');
        return;
    }

    if (m3Enabled && !m3Name) {
        showToast('Por favor, ingresa un nombre para el integrante 3.', 'danger');
        return;
    }

    // Actualizar estado
    state.members.m1.name = m1Name;
    state.members.m2.name = m2Name;
    state.members.m3.name = m3Name || 'Miembro 3';
    state.members.m3.enabled = m3Enabled;

    saveState();
    updateUIElements();
    renderAll();
    showToast('Nombres de integrantes actualizados.', 'success');
}

// Añadir Categoría de Gasto
function handleAddCategoryFormSubmit(e) {
    e.preventDefault();

    const input = document.getElementById('new-category-name');
    let catName = input.value.trim();

    if (!catName) return;

    // Normalizar capitalización o formato si el usuario no incluyó emoji
    // Si no tiene emoji al inicio, podemos dejarlo libre
    if (state.categories.includes(catName)) {
        showToast('Esa categoría ya se encuentra registrada.', 'danger');
        return;
    }

    state.categories.push(catName);
    saveState();
    populateCategorySelectors();
    renderAll();
    
    input.value = '';
    showToast(`Categoría "${catName}" añadida correctamente.`, 'success');
}

// Eliminar Categoría de Gasto
window.removeCategory = function(catName) {
    // Comprobar si hay transacciones asociadas a la categoría
    const isUsed = state.transactions.some(t => t.type === 'expense' && t.category === catName);
    if (isUsed) {
        showToast('No puedes eliminar una categoría que está siendo utilizada por transacciones activas.', 'danger');
        return;
    }

    if (state.categories.length <= 1) {
        showToast('Debes mantener al menos una categoría registrada.', 'danger');
        return;
    }

    if (confirm(`¿Deseas eliminar la categoría "${catName}"?`)) {
        state.categories = state.categories.filter(c => c !== catName);
        saveState();
        populateCategorySelectors();
        renderAll();
        showToast('Categoría eliminada.', 'success');
    }
};

// --- 7. Respaldo y Restauración de Datos ---

// Exportar base de datos a un archivo JSON local
function exportBackup() {
    const dataStr = JSON.stringify(state, null, 4);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `familiafin_backup_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showToast('Respaldo descargado con éxito.', 'success');
}

// Importar datos desde un archivo JSON local
function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const parsedData = JSON.parse(evt.target.result);
            
            // Validar que el archivo JSON tenga la estructura mínima esperada
            if (parsedData.transactions && parsedData.members && parsedData.categories) {
                if (confirm('Esta acción reemplazará TODOS los datos actuales por los del archivo. ¿Deseas continuar?')) {
                    state = parsedData;
                    saveState();
                    updateUIElements();
                    renderAll();
                    showToast('Copia de seguridad restaurada correctamente.', 'success');
                }
            } else {
                showToast('El archivo de respaldo no tiene el formato correcto.', 'danger');
            }
        } catch (error) {
            console.error(error);
            showToast('Ocurrió un error al leer el archivo de respaldo.', 'danger');
        }
    };
    reader.readAsText(file);
    
    // Limpiar input
    e.target.value = '';
}

// Resetear aplicación al estado demo o vaciarla
function resetAllData() {
    if (confirm('⚠️ ADVERTENCIA CRÍTICA: Esto eliminará de forma irreversible todas las transacciones y configuraciones registradas. ¿Estás COMPLETAMENTE seguro de querer borrar todo?')) {
        state = {
            transactions: [],
            members: {
                m1: { name: 'Alvaro', enabled: true },
                m2: { name: 'Bety', enabled: true },
                m3: { name: 'Integrante 3', enabled: false }
            },
            categories: [...seedData.categories],
            activeTab: 'dashboard'
        };
        saveState();
        updateUIElements();
        renderAll();
        showToast('Toda la información ha sido eliminada. Comienzas con lienzo en blanco.', 'info');
    }
}

// Resetear solo las transacciones para empezar una nueva contabilidad, manteniendo integrantes y categorías
function resetTransactionsOnly() {
    if (confirm('¿Estás seguro de que deseas eliminar todas las transacciones para iniciar una nueva contabilidad? Se conservarán tus integrantes y categorías.')) {
        state.transactions = [];
        saveState();
        renderAll();
        showToast('Se han eliminado todas las transacciones. ¡Nueva contabilidad iniciada!', 'success');
    }
}

// --- 8. Descarga de Reporte PDF (html2pdf.js) ---
function downloadPDFReport() {
    const element = document.createElement('div');
    element.className = 'pdf-export-document';
    
    // Obtener parámetros de filtro para armar el PDF
    const reportPeriod = document.getElementById('report-period').value;
    const reportMemberId = document.getElementById('report-contributor').value;
    const customTitle = document.getElementById('report-title').value || 'Reporte de Gastos Familiares';

    let periodLabel = 'Todo el Historial';
    if (reportPeriod === 'this-month') periodLabel = 'Mes Actual';
    if (reportPeriod === 'last-month') periodLabel = 'Mes Anterior';
    if (reportPeriod === 'custom') {
        const startVal = document.getElementById('report-date-start').value;
        const endVal = document.getElementById('report-date-end').value;
        periodLabel = `Rango: ${startVal ? formatDate(startVal) : '...' } al ${endVal ? formatDate(endVal) : '...'}`;
    }

    // Filtrar transacciones para el PDF
    const repTrans = state.transactions.filter(t => {
        if (reportMemberId !== 'all' && t.memberId !== reportMemberId) return false;
        
        const tDate = t.date;
        const nowObj = new Date();
        const year = nowObj.getFullYear();
        const month = String(nowObj.getMonth() + 1).padStart(2, '0');

        if (reportPeriod === 'this-month') {
            if (!tDate.startsWith(`${year}-${month}`)) return false;
        } else if (reportPeriod === 'last-month') {
            const prevMonthObj = new Date(nowObj.getFullYear(), nowObj.getMonth() - 1, 1);
            const pYear = prevMonthObj.getFullYear();
            const pMonth = String(prevMonthObj.getMonth() + 1).padStart(2, '0');
            if (!tDate.startsWith(`${pYear}-${pMonth}`)) return false;
        } else if (reportPeriod === 'custom') {
            const startVal = document.getElementById('report-date-start').value;
            const endVal = document.getElementById('report-date-end').value;
            if (startVal && tDate < startVal) return false;
            if (endVal && tDate > endVal) return false;
        }
        return true;
    });

    repTrans.sort((a,b) => new Date(a.date) - new Date(b.date)); // Orden cronológico para reporte PDF

    // Totales
    let incSum = 0;
    let expSum = 0;
    const memberSum = { '1': { inc: 0, exp: 0 }, '2': { inc: 0, exp: 0 }, '3': { inc: 0, exp: 0 } };
    const catSum = {};
    state.categories.forEach(cat => catSum[cat] = 0);

    repTrans.forEach(t => {
        const amt = parseFloat(t.amount);
        if (t.type === 'income') {
            incSum += amt;
            if (memberSum[t.memberId]) memberSum[t.memberId].inc += amt;
        } else {
            expSum += amt;
            if (memberSum[t.memberId]) memberSum[t.memberId].exp += amt;
            const cat = t.category || 'Otros';
            if (catSum[cat] !== undefined) catSum[cat] += amt;
        }
    });

    const netBal = incSum - expSum;

    // Generar las filas de transacciones
    let rowsHTML = '';
    if (repTrans.length === 0) {
        rowsHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #9ca3af;">No se encontraron registros para los filtros seleccionados.</td></tr>`;
    } else {
        repTrans.forEach(t => {
            const mName = state.members[`m${t.memberId}`].name;
            rowsHTML += `
                <tr>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">${formatDate(t.date)}</td>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-weight:700;">${mName}</td>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">
                        <span style="padding:2px 8px; border-radius:10px; font-size:10px; font-weight:bold; background-color:${t.type === 'income' ? '#ecfdf5' : '#fff1f2'}; color:${t.type === 'income' ? '#059669' : '#e11d48'};">
                            ${t.type === 'income' ? 'Entrada' : 'Salida'}
                        </span>
                    </td>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; color:#4b5563;">${t.type === 'income' ? 'Ingreso' : t.category}</td>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">${escapeHTML(t.description)}</td>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align:right; font-weight:bold; color:${t.type === 'income' ? '#059669' : '#e11d48'};">
                        ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
                    </td>
                </tr>
            `;
        });
    }

    // Filas de miembros
    let memberRowsHTML = '';
    const activeMemberIds = ['1', '2'];
    if (state.members.m3.enabled) activeMemberIds.push('3');

    activeMemberIds.forEach(id => {
        const name = state.members[`m${id}`].name;
        const inc = memberSum[id].inc;
        const exp = memberSum[id].exp;
        const net = inc - exp;
        memberRowsHTML += `
            <tr>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-weight:bold;">${name}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; color:#10b981;">${formatCurrency(inc)}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; color:#ef4444;">${formatCurrency(exp)}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-weight:bold; color:${net >= 0 ? '#10b981' : '#ef4444'};">${formatCurrency(net)}</td>
            </tr>
        `;
    });

    // Categorías en PDF
    let catsHTML = '';
    const activeCats = Object.keys(catSum).filter(c => catSum[c] > 0);
    if (activeCats.length === 0) {
        catsHTML = `<div style="color: #6b7280; font-size: 12px; margin-top: 10px;">No se registraron gastos en el período.</div>`;
    } else {
        catsHTML = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top:10px;">`;
        activeCats.forEach(cat => {
            catsHTML += `
                <div style="display:flex; justify-content:space-between; background-color:#f9fafb; padding:8px 12px; border-radius:6px; font-size:12px;">
                    <span style="font-weight:600; color:#4b5563;">${cat}</span>
                    <span style="font-weight:bold; color:#111827;">${formatCurrency(catSum[cat])}</span>
                </div>
            `;
        });
        catsHTML += `</div>`;
    }

    // Diseñar plantilla HTML in-memory completa para la descarga del PDF
    element.innerHTML = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1f2937; background-color: #ffffff;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px;">
                <div>
                    <h1 style="font-size: 26px; font-weight: 800; color: #4f46e5; margin: 0;">FamiliaFin</h1>
                    <span style="font-size: 12px; color: #6b7280; font-weight: bold; text-transform: uppercase;">Reporte de Balance y Operaciones</span>
                </div>
                <div style="text-align: right; font-size: 12px; color: #4b5563;">
                    <p style="margin: 0; font-weight: bold;">Fecha de Emisión: ${formatDate(new Date().toISOString().split('T')[0])}</p>
                    <p style="margin: 4px 0 0 0; background-color: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 4px; display: inline-block; font-weight: bold;">
                        Filtro: ${periodLabel}
                    </p>
                </div>
            </div>

            <!-- Title -->
            <div style="margin-bottom: 30px;">
                <h2 style="font-size: 20px; font-weight: 800; color: #111827; margin: 0;">${customTitle}</h2>
                <p style="font-size: 13px; color: #6b7280; margin: 4px 0 0 0;">Análisis financiero e histórico detallado de ingresos, salidas y contribuciones del hogar.</p>
            </div>

            <!-- Dashboard Cards -->
            <div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 35px;">
                <div style="flex: 1; background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px;">
                    <span style="font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Ingresos Totales</span>
                    <div style="font-size: 20px; font-weight: 800; color: #10b981; margin-top: 5px;">${formatCurrency(incSum)}</div>
                </div>
                <div style="flex: 1; background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px;">
                    <span style="font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Gastos Totales</span>
                    <div style="font-size: 20px; font-weight: 800; color: #ef4444; margin-top: 5px;">${formatCurrency(expSum)}</div>
                </div>
                <div style="flex: 1; background-color: #f3f4f6; border: 1px solid #4f46e5; border-radius: 8px; padding: 15px; background: linear-gradient(135deg, #f5f3ff, #ffffff);">
                    <span style="font-size: 10px; font-weight: bold; color: #4f46e5; text-transform: uppercase;">Balance Neto</span>
                    <div style="font-size: 20px; font-weight: 800; color: ${netBal >= 0 ? '#10b981' : '#ef4444'}; margin-top: 5px;">${formatCurrency(netBal)}</div>
                </div>
            </div>

            <!-- Contributor Summary -->
            <div style="margin-bottom: 35px;">
                <h3 style="font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 12px; border-bottom: 1.5px solid #e5e7eb; padding-bottom: 5px;">Resumen por Integrante</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background-color: #f9fafb;">
                            <th style="padding: 8px 10px; border-bottom: 2px solid #e5e7eb; text-align: left; font-weight: bold; color: #4b5563;">Integrante</th>
                            <th style="padding: 8px 10px; border-bottom: 2px solid #e5e7eb; text-align: left; font-weight: bold; color: #4b5563;">Ingresos (Aportado)</th>
                            <th style="padding: 8px 10px; border-bottom: 2px solid #e5e7eb; text-align: left; font-weight: bold; color: #4b5563;">Gastos (Retirado)</th>
                            <th style="padding: 8px 10px; border-bottom: 2px solid #e5e7eb; text-align: left; font-weight: bold; color: #4b5563;">Neto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${memberRowsHTML}
                    </tbody>
                </table>
            </div>

            <!-- Categories Summary -->
            <div style="margin-bottom: 35px; page-break-inside: avoid;">
                <h3 style="font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 12px; border-bottom: 1.5px solid #e5e7eb; padding-bottom: 5px;">Gastos por Categoría</h3>
                ${catsHTML}
            </div>

            <!-- Transactions List -->
            <div style="margin-bottom: 15px; page-break-inside: avoid;">
                <h3 style="font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 12px; border-bottom: 1.5px solid #e5e7eb; padding-bottom: 5px;">Listado de Operaciones</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="background-color: #f9fafb;">
                            <th style="padding: 8px 10px; border-bottom: 2px solid #e5e7eb; text-align: left; font-weight: bold; color: #4b5563;">Fecha</th>
                            <th style="padding: 8px 10px; border-bottom: 2px solid #e5e7eb; text-align: left; font-weight: bold; color: #4b5563;">Integrante</th>
                            <th style="padding: 8px 10px; border-bottom: 2px solid #e5e7eb; text-align: left; font-weight: bold; color: #4b5563;">Tipo</th>
                            <th style="padding: 8px 10px; border-bottom: 2px solid #e5e7eb; text-align: left; font-weight: bold; color: #4b5563;">Categoría</th>
                            <th style="padding: 8px 10px; border-bottom: 2px solid #e5e7eb; text-align: left; font-weight: bold; color: #4b5563;">Descripción</th>
                            <th style="padding: 8px 10px; border-bottom: 2px solid #e5e7eb; text-align: right; font-weight: bold; color: #4b5563;">Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML}
                    </tbody>
                </table>
            </div>

            <!-- PDF Footer -->
            <div style="margin-top: 40px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; font-size: 10px; color: #9ca3af;">
                FamiliaFin - Aplicación Autónoma Local de Control de Finanzas de Hogar. Los datos son privados y confidenciales.
            </div>
        </div>
    `;

    // Configurar opciones de html2pdf.js
    const opt = {
        margin:       12,
        filename:     `reporte_finanzas_${new Date().toISOString().slice(0,10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    showToast('Generando reporte PDF...', 'info');

    // Ejecutar conversión y descarga
    html2pdf().from(element).set(opt).save()
        .then(() => {
            showToast('¡Tu reporte PDF ha sido descargado!', 'success');
        })
        .catch(err => {
            console.error('Error al generar PDF:', err);
            showToast('Hubo un error al generar tu PDF.', 'danger');
        });
}

// --- 9. Manejadores de Eventos y Enrutado (Tabs) ---
function setupEventListeners() {
    // 1. Navegación por Solapas (Tabs)
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabs = document.querySelectorAll('.tab-content');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            // Quitar active de todo
            navButtons.forEach(b => b.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));

            // Añadir active al clickeado
            btn.classList.add('active');
            const activeTabContent = document.getElementById(`tab-${targetTab}`);
            if (activeTabContent) {
                activeTabContent.classList.add('active');
            }

            // Actualizar textos superiores de la página
            updateTabHeaderInfo(targetTab);
            
            // Guardar tab en estado
            state.activeTab = targetTab;

            // Al abrir reportes o transacciones, refrescar previsualizaciones o listados
            if (targetTab === 'transactions') {
                renderTransactionsTable();
            } else if (targetTab === 'reports') {
                renderPDFPreview();
            }
        });
    });

    // Enlace rápido de "Ver Todas" en el dashboard
    document.getElementById('btn-see-all-transactions').addEventListener('click', () => {
        // Simular click en la pestaña de transacciones
        const btnTrans = document.querySelector('.nav-btn[data-tab="transactions"]');
        if (btnTrans) btnTrans.click();
    });

    // 2. Modales de Transacción
    document.getElementById('btn-open-transaction-modal').addEventListener('click', openCreateModal);
    document.getElementById('btn-close-transaction-modal').addEventListener('click', closeTransactionModal);
    document.getElementById('btn-cancel-transaction').addEventListener('click', closeTransactionModal);
    document.getElementById('transaction-form').addEventListener('submit', handleTransactionFormSubmit);

    // Dynamic show/hide category based on Transaction Type selector in Modal
    document.getElementById('type-expense').addEventListener('change', (e) => {
        if (e.target.checked) {
            document.getElementById('category-group').style.display = 'flex';
            document.getElementById('trans-category').required = true;
        }
    });

    document.getElementById('type-income').addEventListener('change', (e) => {
        if (e.target.checked) {
            document.getElementById('category-group').style.display = 'none';
            document.getElementById('trans-category').required = false;
        }
    });

    // 3. Filtros de Transacciones
    document.getElementById('search-description').addEventListener('input', renderTransactionsTable);
    document.getElementById('filter-type').addEventListener('change', renderTransactionsTable);
    document.getElementById('filter-member').addEventListener('change', renderTransactionsTable);
    document.getElementById('filter-category').addEventListener('change', renderTransactionsTable);
    
    document.getElementById('filter-date').addEventListener('change', (e) => {
        const customDatesEl = document.getElementById('filter-custom-dates');
        if (e.target.value === 'custom') {
            customDatesEl.classList.remove('hidden');
        } else {
            customDatesEl.classList.add('hidden');
            document.getElementById('filter-date-start').value = '';
            document.getElementById('filter-date-end').value = '';
        }
        renderTransactionsTable();
    });
    
    document.getElementById('filter-date-start').addEventListener('change', renderTransactionsTable);
    document.getElementById('filter-date-end').addEventListener('change', renderTransactionsTable);

    document.getElementById('btn-clear-filters').addEventListener('click', () => {
        document.getElementById('search-description').value = '';
        document.getElementById('filter-type').value = 'all';
        document.getElementById('filter-member').value = 'all';
        document.getElementById('filter-category').value = 'all';
        document.getElementById('filter-date').value = 'all';
        document.getElementById('filter-custom-dates').classList.add('hidden');
        document.getElementById('filter-date-start').value = '';
        document.getElementById('filter-date-end').value = '';
        renderTransactionsTable();
        showToast('Filtros reiniciados.', 'info');
    });

    // 4. Formularios de Configuración
    document.getElementById('settings-members-form').addEventListener('submit', handleMembersFormSubmit);
    document.getElementById('add-category-form').addEventListener('submit', handleAddCategoryFormSubmit);

    // Toggle en el integrante 3
    const m3Check = document.getElementById('m3-enabled');
    const m3Input = document.getElementById('m3-name');
    const m3Wrapper = document.getElementById('m3-input-wrapper');
    m3Check.addEventListener('change', (e) => {
        if (e.target.checked) {
            m3Input.disabled = false;
            m3Wrapper.classList.remove('disabled');
        } else {
            m3Input.disabled = true;
            m3Wrapper.classList.add('disabled');
        }
    });

    // Respaldos y Borrado
    document.getElementById('btn-export-backup').addEventListener('click', exportBackup);
    document.getElementById('input-import-backup').addEventListener('change', importBackup);
    document.getElementById('btn-reset-data').addEventListener('click', resetAllData);
    document.getElementById('btn-reset-transactions').addEventListener('click', resetTransactionsOnly);

    // 5. Configuración de Reportes (PDF) y Previsualización Dinámica
    document.getElementById('report-period').addEventListener('change', (e) => {
        const customDatesEl = document.getElementById('report-custom-dates');
        if (e.target.value === 'custom') {
            customDatesEl.classList.remove('hidden');
        } else {
            customDatesEl.classList.add('hidden');
            document.getElementById('report-date-start').value = '';
            document.getElementById('report-date-end').value = '';
        }
        renderPDFPreview();
    });

    document.getElementById('report-date-start').addEventListener('change', renderPDFPreview);
    document.getElementById('report-date-end').addEventListener('change', renderPDFPreview);

    document.getElementById('report-generator-form').addEventListener('change', renderPDFPreview);
    document.getElementById('report-generator-form').addEventListener('input', renderPDFPreview);
    document.getElementById('btn-generate-pdf').addEventListener('click', downloadPDFReport);
}

// Auxiliar: Actualizar el título de la página según la solapa activa
function updateTabHeaderInfo(tabId) {
    const titleEl = document.getElementById('current-tab-title');
    const descEl = document.getElementById('current-tab-desc');

    if (tabId === 'dashboard') {
        titleEl.innerText = 'Resumen de Cuenta';
        descEl.innerText = 'Control general de aportes, ingresos y gastos familiares.';
    } else if (tabId === 'transactions') {
        titleEl.innerText = 'Historial de Transacciones';
        descEl.innerText = 'Explora, busca y edita cualquier entrada o salida registrada.';
    } else if (tabId === 'reports') {
        titleEl.innerText = 'Centro de Reportes PDF';
        descEl.innerText = 'Exporta estados de cuenta familiares listos para imprimir o compartir.';
    } else if (tabId === 'settings') {
        titleEl.innerText = 'Configuración General';
        descEl.innerText = 'Personaliza integrantes del hogar, categorías de gastos y copias de respaldo.';
    }
}

// --- 10. Funciones Auxiliares y Formateadores ---

// Formatear Moneda a pesos / USD (e.g. $1,250.00)
function formatCurrency(value) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2
    }).format(value);
}

// Formatear Fecha (YYYY-MM-DD a dd/mm/aaaa)
function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Escapar HTML para evitar XSS
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Mostrar Toast Toast notificativos flotantes
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconName = 'check-circle';
    if (type === 'danger') iconName = 'alert-triangle';
    if (type === 'info') iconName = 'info';

    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    
    // Inicializar icono recién inyectado
    lucide.createIcons();

    // Eliminar después de 4 segundos
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 4000);
}
