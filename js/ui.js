/**
 * SocioCheck AI - UI Rendering & Interaction Module
 */

let zoomLevel = 1.0;
let activeRecord = null;

// CSS Variables / classes are used for the theme logic, managed by bootstrap.

export function showSpinner(text) {
    const feedback = document.getElementById("upload-feedback");
    const dropzone = document.getElementById("dropzone");
    const spinnerText = document.getElementById("spinner-text");

    if (spinnerText) spinnerText.textContent = text;
    if (dropzone) dropzone.style.display = "none";
    if (feedback) feedback.style.display = "flex";
}

export function hideSpinner() {
    const feedback = document.getElementById("upload-feedback");
    const dropzone = document.getElementById("dropzone");

    if (feedback) feedback.style.display = "none";
    if (dropzone) dropzone.style.display = "block";
}

/**
 * Show a sleek Toast notification
 */
export function showToast(title, message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "";
    if (type === "success") {
        icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (type === "error") {
        icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else {
        icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    }

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-msg-container">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Fade out and remove
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(20px)";
        setTimeout(() => {
            if (toast.parentNode === container) {
                container.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

/**
 * Formats ISO Date to readable format
 */
export function formatDate(isoString) {
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }) + " " + date.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch (e) {
        return isoString;
    }
}

/**
 * Updates stats counter and donut chart
 */
export function updateDashboard(records, rejectedCount) {
    const totalCount = records.length;
    const poderesCount = records.filter(r => r.tipo === "Poder").length;
    const cartasCount = records.filter(r => r.tipo === "Carta").length;

    document.getElementById("stat-total").textContent = totalCount;
    document.getElementById("stat-poderes").textContent = poderesCount;
    document.getElementById("stat-cartas").textContent = cartasCount;
    document.getElementById("stat-rechazados").textContent = rejectedCount;

    document.getElementById("chart-total-text").textContent = totalCount;

    // Donut chart updates
    const totalDocs = poderesCount + cartasCount;
    const segmentPoderes = document.querySelector(".segment-poderes");
    const segmentCartas = document.querySelector(".segment-cartas");

    const legendPoderesPct = document.getElementById("legend-poderes-pct");
    const legendCartasPct = document.getElementById("legend-cartas-pct");

    if (totalDocs === 0) {
        if (segmentPoderes) segmentPoderes.setAttribute("stroke-dasharray", `0 502`);
        if (segmentCartas) segmentCartas.setAttribute("stroke-dasharray", `0 502`);
        if (legendPoderesPct) legendPoderesPct.textContent = "0%";
        if (legendCartasPct) legendCartasPct.textContent = "0%";
    } else {
        const poderesPct = (poderesCount / totalDocs) * 100;
        const cartasPct = (cartasCount / totalDocs) * 100;

        if (legendPoderesPct) legendPoderesPct.textContent = `${Math.round(poderesPct)}%`;
        if (legendCartasPct) legendCartasPct.textContent = `${Math.round(cartasPct)}%`;

        const totalCircumference = 502.65; // 2 * pi * r (r=80)
        const poderesLength = (poderesCount / totalDocs) * totalCircumference;
        const cartasLength = (cartasCount / totalDocs) * totalCircumference;

        if (segmentPoderes) {
            segmentPoderes.setAttribute("stroke-dasharray", `${poderesLength} ${totalCircumference}`);
        }
        if (segmentCartas) {
            segmentCartas.setAttribute("stroke-dasharray", `${cartasLength} ${totalCircumference}`);
            segmentCartas.setAttribute("stroke-dashoffset", `-${poderesLength}`);
        }
    }
}

/**
 * Render the main audit history table
 */
export function renderHistoryTable(records, onRowClick) {
    const tbody = document.querySelector("#table-history tbody");
    if (!tbody) return;
    
    tbody.innerHTML = "";

    if (records.length === 0) {
        tbody.innerHTML = `<tr id="empty-row"><td colspan="5" class="text-center">No se han procesado documentos en esta sesión.</td></tr>`;
        return;
    }

    records.forEach(record => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.className = activeRecord && activeRecord.socio_no === record.socio_no ? "active-row" : "";
        
        tr.addEventListener("click", () => {
            document.querySelectorAll("#table-history tbody tr").forEach(row => row.classList.remove("active-row"));
            tr.classList.add("active-row");
            onRowClick(record);
        });

        const badgeTypeClass = record.tipo === "Poder" ? "badge-poder" : "badge-carta";
        const badgeStatusClass = record.estado === "Aprobado" ? "badge-status-approved" : "badge-status-duplicate";

        tr.innerHTML = `
            <td><strong>${record.socio_no}</strong></td>
            <td>${record.nombre}</td>
            <td><span class="badge ${badgeTypeClass}">${record.tipo}</span></td>
            <td>${formatDate(record.fecha)}</td>
            <td><span class="badge ${badgeStatusClass}">${record.estado}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Render the admin panel table with delete action
 */
export function renderAdminTable(records, deleteRecordCallback, searchQuery = "") {
    const tbody = document.querySelector("#admin-table tbody");
    if (!tbody) return;
    
    tbody.innerHTML = "";

    const query = searchQuery.toLowerCase().trim();
    const filtered = records.filter(record => 
        record.socio_no.includes(query) || 
        record.nombre.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">Ningún socio registrado coincide con la búsqueda.</td></tr>`;
        return;
    }

    filtered.forEach(record => {
        const tr = document.createElement("tr");
        const badgeTypeClass = record.tipo === "Poder" ? "badge-poder" : "badge-carta";

        tr.innerHTML = `
            <td><strong>${record.socio_no}</strong></td>
            <td>${record.nombre}</td>
            <td><span class="badge ${badgeTypeClass}">${record.tipo}</span></td>
            <td>${formatDate(record.fecha)}</td>
            <td><span class="badge badge-status-approved">Activo</span></td>
            <td>
                <button class="btn btn-icon btn-danger-icon" data-socio="${record.socio_no}" title="Eliminar Registro">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-danger);"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </td>
        `;
        
        const deleteBtn = tr.querySelector("button");
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteRecordCallback(record.socio_no);
        });

        tbody.appendChild(tr);
    });
}

/**
 * Updates the document previewer with selected record details
 */
export function updatePreviewer(record) {
    activeRecord = record;
    const viewport = document.getElementById("previewer-viewport");
    const title = document.getElementById("previewer-title");
    
    if (!viewport) return;

    if (!record) {
        title.textContent = "Vista Previa del Documento";
        viewport.innerHTML = `
            <div class="previewer-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p>Selecciona un registro para ver el documento</p>
            </div>
        `;
        return;
    }

    title.textContent = `Socio ${record.socio_no} - ${record.nombre}`;
    resetZoom();

    let elementHtml = "";
    if (record.file_path) {
        const ext = record.file_path.split('.').pop().toLowerCase();
        const fullPath = record.file_path; // Serves from Node public upload folder
        
        if (ext === 'pdf') {
            elementHtml = `
                <iframe src="${fullPath}" class="preview-element" id="preview-frame" style="width: 100%; height: 100%; border: none;"></iframe>
            `;
        } else if (['jpg', 'jpeg', 'png', 'svg'].includes(ext)) {
            elementHtml = `
                <div class="preview-img-container" style="overflow: auto; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                    <img src="${fullPath}" class="preview-element" id="preview-image" alt="Documento de Socio" style="max-width: 100%; max-height: 100%; object-fit: contain; transition: transform 0.2s ease; transform-origin: center center;" />
                </div>
            `;
        } else {
            // Text or unknown
            elementHtml = `
                <div class="preview-text-container" style="padding: 1.5rem; font-family: monospace; font-size: 0.9rem; overflow-y: auto; text-align: left; height: 100%; background: rgba(0,0,0,0.2);">
                    <p style="white-space: pre-wrap; color: var(--text-primary);">${record.extracto || 'Sin contenido de texto disponible.'}</p>
                </div>
            `;
        }
    } else {
        // Fallback for manually typed text records
        elementHtml = `
            <div class="preview-text-container" style="padding: 1.5rem; font-family: monospace; font-size: 0.9rem; overflow-y: auto; text-align: left; height: 100%; background: rgba(0,0,0,0.2);">
                <p style="white-space: pre-wrap; color: var(--text-primary);">${record.extracto || 'Sin contenido de texto disponible.'}</p>
            </div>
        `;
    }

    // Add document description below or inside the viewport
    viewport.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%; width: 100%;">
            <div class="previewer-render-area" style="flex: 1; min-height: 0; position: relative;">
                ${elementHtml}
            </div>
            <div class="previewer-details-card" style="padding: 1rem; border-top: 1px solid var(--border-color); background: rgba(0,0,0,0.1); font-size: 0.85rem; text-align: left;">
                <strong style="color: var(--color-primary);">Extracto/Resultado de Clasificación:</strong>
                <p style="margin-top: 4px; color: var(--text-secondary); white-space: normal; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
                    ${record.extracto || 'Clasificación de documento exitosa.'}
                </p>
            </div>
        </div>
    `;
}

/**
 * Initialize zoom level control event listeners
 */
export function initZoomControls() {
    const btnIn = document.getElementById("btn-zoom-in");
    const btnOut = document.getElementById("btn-zoom-out");
    const btnReset = document.getElementById("btn-zoom-reset");
    
    if (btnIn) btnIn.addEventListener("click", zoomIn);
    if (btnOut) btnOut.addEventListener("click", zoomOut);
    if (btnReset) btnReset.addEventListener("click", resetZoom);
}

function zoomIn() {
    if (zoomLevel < 3.0) {
        zoomLevel += 0.2;
        applyZoom();
    }
}

function zoomOut() {
    if (zoomLevel > 0.4) {
        zoomLevel -= 0.2;
        applyZoom();
    }
}

function resetZoom() {
    zoomLevel = 1.0;
    applyZoom();
}

function applyZoom() {
    const img = document.getElementById("preview-image");
    const zoomText = document.getElementById("zoom-level");
    
    if (zoomText) {
        zoomText.textContent = `${Math.round(zoomLevel * 100)}%`;
    }
    
    if (img) {
        img.style.transform = `scale(${zoomLevel})`;
    }
}
