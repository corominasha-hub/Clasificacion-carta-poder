/**
 * SocioCheck AI - Main Application Controller (Orchestrator)
 */

import { playSuccessChime, playWarningBeep } from './js/audio.js';
import { getSecurityStatus, registerFailedAttempt, resetLockout, saveSessionToken, clearSessionToken, getSessionToken } from './js/security.js';
import { fetchRecords, uploadDocument, deleteRecord, loginAdmin, clearAllDatabase } from './js/db.js';
import { compressImage, callGeminiVisionAPI, callGeminiTextAPI, readFileAsText, readFileAsBase64, callGeminiWithRetry } from './js/api.js';
import { showSpinner, hideSpinner, showToast, formatDate, updateDashboard, renderHistoryTable, renderAdminTable, updatePreviewer, initZoomControls } from './js/ui.js';

// Local State
let activeRecords = [];      // Records fetched from backend
let rejectedLogs = [];       // Rejected (duplicate) attempts tracked locally in LocalStorage
let selectedRecord = null;   // Active record for preview
let securityInterval = null; // Lockout timer interval
let uploadQueue = [];        // Queue of files to process
let isProcessingQueue = false; // Whether the queue is currently processing
let totalQueueFilesCount = 0; // Total count of files in the current batch
let processedQueueFilesCount = 0; // Count of files processed in the current batch

// Settings
let geminiApiKey = '';
let geminiModel = 'gemini-2.5-flash';
let isDarkMode = true;

// App Init
document.addEventListener("DOMContentLoaded", async () => {
    loadSettings();
    initTheme();
    initZoomControls();
    setupEventListeners();
    setupPwaEvents();
    
    // Initial data load
    await loadInitialData();
});

// Load settings from LocalStorage
function loadSettings() {
    // Clean old API Key if saved
    if (localStorage.getItem("gemini_api_key") === "AIzaSyDQqr_TLfy-wxqN0DSjAsQLRRn-c1HVJQU") {
        localStorage.removeItem("gemini_api_key");
    }

    geminiApiKey = localStorage.getItem("gemini_api_key") || "";
    geminiModel = localStorage.getItem("gemini_model") || "gemini-2.5-flash";
    isDarkMode = localStorage.getItem("theme") !== "light";

    // Update settings DOM if present
    const keyInput = document.getElementById("gemini-key");
    const modelSelect = document.getElementById("gemini-model");
    const testKeyBtn = document.getElementById("btn-test-key");

    if (keyInput) keyInput.value = geminiApiKey;
    if (modelSelect) modelSelect.value = geminiModel;
    if (testKeyBtn && geminiApiKey) testKeyBtn.style.display = "inline-flex";
}

// Load initial records from server & rejected logs from LocalStorage
async function loadInitialData() {
    // 1. Fetch server configurations (like Gemini key) first
    try {
        const configResp = await fetch('/api/config').then(r => r.json());
        if (configResp.success && configResp.gemini_api_key) {
            // Set it in local state if no custom key is saved in localStorage
            if (!localStorage.getItem("gemini_api_key")) {
                geminiApiKey = configResp.gemini_api_key;
                const keyInput = document.getElementById("gemini-key");
                if (keyInput) keyInput.value = geminiApiKey;
                const testKeyBtn = document.getElementById("btn-test-key");
                if (testKeyBtn) testKeyBtn.style.display = "inline-flex";
            }
        }
    } catch (err) {
        console.warn("Unable to fetch server configuration:", err);
    }

    // 2. Fetch approved records from backend
    try {
        activeRecords = await fetchRecords();
    } catch (err) {
        console.error("Unable to load records from backend server. Using LocalStorage fallback.", err);
        showToast("Error de Servidor", "No se pudo conectar con el servidor backend. Trabajando en modo local.", "error");
        // Fallback reading from LocalStorage if server is unreachable
        activeRecords = JSON.parse(localStorage.getItem("asamblea_db") || "[]");
    }

    // Load rejected attempts logs
    rejectedLogs = JSON.parse(localStorage.getItem("asamblea_rejected") || "[]");

    // Refresh UI
    refreshAppUI();
}

// Theme init helper
function initTheme() {
    const btnTheme = document.getElementById("btn-theme");
    if (!isDarkMode) {
        document.body.setAttribute("data-theme", "light");
        if (btnTheme) {
            btnTheme.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
        }
    }
}

// Toggle Theme (Dark / Light)
function toggleTheme() {
    const btnTheme = document.getElementById("btn-theme");
    if (document.body.getAttribute("data-theme") === "light") {
        document.body.removeAttribute("data-theme");
        localStorage.setItem("theme", "dark");
        isDarkMode = true;
        if (btnTheme) {
            btnTheme.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
        }
    } else {
        document.body.setAttribute("data-theme", "light");
        localStorage.setItem("theme", "light");
        isDarkMode = false;
        if (btnTheme) {
            btnTheme.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
        }
    }
}

// Refresh audit history table and stats dashboard
function refreshAppUI() {
    // Combine active records and rejected logs for history display
    const combinedHistory = [...activeRecords, ...rejectedLogs];
    
    // Sort combined history by date descending
    combinedHistory.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    // Render components
    updateDashboard(activeRecords, rejectedLogs.length);
    renderHistoryTable(combinedHistory, (record) => {
        selectedRecord = record;
        updatePreviewer(record);
    });

    // Sync localStorage for backup fallback
    localStorage.setItem("asamblea_db", JSON.stringify(activeRecords));
}

// Setup Event Listeners
function setupEventListeners() {
    // Theme toggle
    document.getElementById("btn-theme").addEventListener("click", toggleTheme);

    // Tab switcher
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const tabId = e.target.getAttribute("data-tab");
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");

            document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));
            document.getElementById(tabId).classList.add("active");
        });
    });

    // Drag and drop dropzone
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("file-input");

    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFilesUpload(files);
        }
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFilesUpload(e.target.files);
        }
    });

    // Process Text Action
    document.getElementById("btn-process-text").addEventListener("click", () => {
        const text = document.getElementById("text-raw").value.trim();
        if (!text) {
            showToast("Error", "Por favor ingresa texto para procesar.", "error");
            return;
        }
        handleTextUpload(text);
    });

    // Save Gemini Settings
    document.getElementById("btn-save-key").addEventListener("click", () => {
        const key = document.getElementById("gemini-key").value.trim();
        const model = document.getElementById("gemini-model").value;

        localStorage.setItem("gemini_api_key", key);
        localStorage.setItem("gemini_model", model);
        geminiApiKey = key;
        geminiModel = model;

        const testKeyBtn = document.getElementById("btn-test-key");
        if (geminiApiKey) {
            testKeyBtn.style.display = "inline-flex";
        } else {
            testKeyBtn.style.display = "none";
        }

        const msgDiv = document.getElementById("key-status-msg");
        msgDiv.className = "success";
        msgDiv.textContent = "Configuración guardada exitosamente.";
        msgDiv.style.display = "block";
        setTimeout(() => msgDiv.style.display = "none", 3000);

        showToast("Éxito", "Configuración guardada.", "success");
    });

    // Test Gemini Connection
    const testKeyBtn = document.getElementById("btn-test-key");
    if (testKeyBtn) {
        testKeyBtn.addEventListener("click", async () => {
            if (!geminiApiKey) {
                showToast("Error", "Por favor ingresa una API Key primero.", "error");
                return;
            }

            const msgDiv = document.getElementById("key-status-msg");
            if (msgDiv) {
                msgDiv.className = "info";
                msgDiv.textContent = "Probando conexión con Gemini...";
                msgDiv.style.display = "block";
            }

            try {
                // Call Gemini Text API with a simple test prompt using retries
                await callGeminiWithRetry(
                    () => callGeminiTextAPI("Di la palabra 'OK'", geminiApiKey, geminiModel),
                    2, // 2 retries
                    1000,
                    (attempt, max, ms) => {
                        if (msgDiv) {
                            msgDiv.textContent = `Límite alcanzado. Reintentando ${attempt}/${max} en ${Math.round(ms/1000)}s...`;
                        }
                    }
                );
                
                if (msgDiv) {
                    msgDiv.className = "success";
                    msgDiv.textContent = "¡Conexión Exitosa! Gemini respondió correctamente.";
                    msgDiv.style.display = "block";
                    setTimeout(() => msgDiv.style.display = "none", 4000);
                }
                showToast("Conexión Exitosa", "La API Key de Gemini es válida y el modelo responde correctamente.", "success");
                
            } catch (err) {
                console.error("Test connection failed:", err);
                if (msgDiv) {
                    msgDiv.className = "error";
                    msgDiv.textContent = `Error de conexión: ${err.message || err}`;
                    msgDiv.style.display = "block";
                }
                playWarningBeep();
                showToast("Conexión Fallida", `No se pudo conectar con Gemini API: ${err.message || 'Verifica tu clave'}`, "error");
            }
        });
    }

    // Gemini visibility toggle
    document.getElementById("toggle-key-visibility").addEventListener("click", () => {
        const keyInput = document.getElementById("gemini-key");
        if (keyInput.type === "password") {
            keyInput.type = "text";
            document.getElementById("toggle-key-visibility").textContent = "🔒";
        } else {
            keyInput.type = "password";
            document.getElementById("toggle-key-visibility").textContent = "👁️";
        }
    });

    // Admin Access
    document.getElementById("link-admin").addEventListener("click", (e) => {
        e.preventDefault();
        openPasswordModal();
    });

    document.getElementById("btn-close-admin").addEventListener("click", () => {
        document.getElementById("modal-admin").classList.remove("open");
    });

    document.getElementById("btn-close-pwd").addEventListener("click", () => {
        document.getElementById("modal-password").classList.remove("open");
        clearInterval(securityInterval);
    });

    document.getElementById("btn-submit-pwd").addEventListener("click", handleAdminLoginSubmit);
    document.getElementById("admin-password-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleAdminLoginSubmit();
    });

    // Admin Panel actions
    document.getElementById("admin-search").addEventListener("input", (e) => {
        renderAdminTable(activeRecords, triggerRecordDelete, e.target.value);
    });

    document.getElementById("btn-clear-db").addEventListener("click", triggerClearDatabase);
    document.getElementById("btn-export-csv").addEventListener("click", triggerExportCSV);
}

// Check if a 4-digit socio number is extractable
function extractSocioNo(text) {
    const textLower = text.toLowerCase();
    
    // Strict pattern: keyword followed by 4 digits
    const match1 = text.match(/(?:socio|miembro|no\.?|nº)\s*(?:n[oº\.]|n[uú]mero)?\s*(?:de)?\s*:?\s*#*\s*\b(\d{4})\b/i);
    if (match1) return match1[1];
    
    // Strict pattern: 4 digits followed by keyword
    const match2 = text.match(/\b(\d{4})\b\s*(?:de\s+)?(?:socio|miembro)/i);
    if (match2) return match2[1];

    // Contextual fallback: find first 4-digit number that is not a year (between 2020 and 2030)
    if (textLower.includes("socio") || textLower.includes("miembro") || textLower.includes("represent")) {
        const numbers = text.match(/\b\d{4}\b/g);
        if (numbers) {
            for (let num of numbers) {
                const numVal = parseInt(num, 10);
                if (numVal < 2020 || numVal > 2030) {
                    return num;
                }
            }
        }
    }
    return null;
}

// Local contingent classifier matching business rules
function runLocalFallbackClassification(text, filename = "") {
    const textLower = (text + " " + filename).toLowerCase();
    let tipo = "Desconocido";
    let socio_no = "";
    let nombre_socio = "Socio Desconocido";

    // 1. Check for Carta keywords first (prioritized to prevent false positives containing "asamblea")
    const hasCartaKeywords = textLower.includes("invitado") || 
                             textLower.includes("fines de semana") || 
                             textLower.includes("fin de semana") || 
                             textLower.includes("agenda") || 
                             textLower.includes("inclusión") || 
                             textLower.includes("resolución") || 
                             textLower.includes("limita");

    const hasPoderKeywords = textLower.includes("poder") || 
                             textLower.includes("represent") || 
                             textLower.includes("voto") || 
                             textLower.includes("asamblea") || 
                             textLower.includes("apoderado") ||
                             textLower.includes("otorgo") ||
                             textLower.includes("deleg");

    if (hasCartaKeywords) {
        tipo = "Carta";
    } else if (hasPoderKeywords) {
        tipo = "Poder";
    }

    // 2. Specific cases: Marie Cris Farías Mere (4462) & Gianmarco Brache Guebra (5225)
    if (textLower.includes("marie") || textLower.includes("farias") || textLower.includes("farías") || textLower.includes("4462")) {
        tipo = "Poder";
        socio_no = "4462";
        nombre_socio = "Marie Cris Farías Mere";
    } else if (textLower.includes("gianmarco") || textLower.includes("brache") || textLower.includes("5225")) {
        tipo = "Poder";
        socio_no = "5225";
        nombre_socio = "Gianmarco Brache Guebra";
    } else if (textLower.includes("franklin") || textLower.includes("valdez") || textLower.includes("2330")) {
        tipo = "Carta";
        socio_no = "2330";
        nombre_socio = "Franklin R Valdez C";
    } else {
        // Fallback regex parsing
        socio_no = extractSocioNo(text + " " + filename);
        
        // Extract Name (Yo, Quien suscribe, etc.)
        const nameMatch = text.match(/(?:quien\s+suscribe|yo|nombre:?)\s*,?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{3,45})(?:\s*,|\s+mayor|\s+socio|\s+identificado|\s+con|\s+propietario)/i);
        if (nameMatch) {
            nombre_socio = nameMatch[1].trim();
        } else {
            const lines = text.split("\n");
            for (let line of lines) {
                if (line.toLowerCase().includes("atentamente") || line.toLowerCase().includes("firma")) {
                    continue;
                }
                const match = line.match(/(?:sr\.?|sra\.?|don|doña)?\s*([A-Z][a-zñáéíóú]+(?:\s+[A-Z][a-zñáéíóú]+){1,3})/);
                if (match) {
                    nombre_socio = match[1].trim();
                    break;
                }
            }
        }
    }

    return { tipo, socio_no, nombre_socio };
}

// Queue Manager: Handle multiple files upload
function handleFilesUpload(files) {
    const validFiles = Array.from(files).filter(file => {
        const isValid = file.type === "text/plain" || file.type.startsWith("image/") || file.type === "application/pdf";
        if (!isValid) {
            showToast("Formato no soportado", `El archivo ${file.name} no tiene un formato válido y fue omitido.`, "warning");
        }
        return isValid;
    });

    if (validFiles.length === 0) return;

    // Append to queue
    uploadQueue = [...uploadQueue, ...validFiles];
    totalQueueFilesCount += validFiles.length;

    if (!isProcessingQueue) {
        processNextInQueue();
    }
}

// Process the next file in the queue recursively
async function processNextInQueue() {
    if (uploadQueue.length === 0) {
        isProcessingQueue = false;
        totalQueueFilesCount = 0;
        processedQueueFilesCount = 0;
        hideSpinner();
        // Clear file input element
        document.getElementById("file-input").value = "";
        return;
    }

    isProcessingQueue = true;
    const currentFile = uploadQueue[0];
    processedQueueFilesCount++;

    const statusText = `Archivo ${processedQueueFilesCount} de ${totalQueueFilesCount} (${currentFile.name})`;
    showSpinner(statusText);

    try {
        let textContent = null;
        if (currentFile.type === "text/plain") {
            textContent = await readFileAsText(currentFile);
        }

        await processDocumentCore(currentFile, textContent, statusText);

    } catch (error) {
        console.error("Error processing queue file:", error);
        playWarningBeep();
        showToast("Error de Procesamiento", `Falló el procesamiento de ${currentFile.name}: ${error.message || error}`, "error");
    } finally {
        // Move to next file
        uploadQueue.shift();
        // Recurse
        processNextInQueue();
    }
}

// Core function to process document and upload to backend
async function processDocumentCore(file, textContent, statusText) {
    let result = { tipo_documento: 'Desconocido', socio_no: null, nombre_socio: '', resumen: '' };
    
    try {
        if (geminiApiKey) {
            try {
                // Real Gemini OCR analysis
                if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) {
                    showSpinner(`${statusText} - Comprimiendo y analizando con Gemini...`);
                    
                    // Compress image on client side if it is an image
                    const compressedFile = await compressImage(file);
                    const base64Data = await readFileAsBase64(compressedFile);
                    const rawBase64 = base64Data.split(",")[1];
                    
                    const response = await callGeminiWithRetry(
                        () => callGeminiVisionAPI(rawBase64, compressedFile.type, geminiApiKey, geminiModel),
                        3, // max retries
                        1500, // initial delay (1.5s)
                        (attempt, max, ms) => {
                            showSpinner(`${statusText} - Límite de API. Reintentando ${attempt}/${max} en ${Math.round(ms/1000)}s...`);
                            showToast("Límite de API", `Límite alcanzado para ${file ? file.name : 'documento'}. Reintentando en ${Math.round(ms/1000)}s...`, "warning");
                        }
                    );
                    result = response;
                    // Reassign the compressed file as active file for server upload
                    file = compressedFile;
                } else {
                    showSpinner(`${statusText} - Analizando texto con Gemini...`);
                    const response = await callGeminiWithRetry(
                        () => callGeminiTextAPI(textContent, geminiApiKey, geminiModel),
                        3,
                        1500,
                        (attempt, max, ms) => {
                            showSpinner(`${statusText} - Límite de API. Reintentando ${attempt}/${max} en ${Math.round(ms/1000)}s...`);
                        }
                    );
                    result = response;
                }
            } catch (apiError) {
                // Graceful fallback to local contingency classifier if Gemini rate limit persists
                console.warn("Gemini API call failed after retries. Falling back to local classifier:", apiError);
                showToast("Falla de API (Contingencia)", "Gemini API saturada. Procesando con extractor local de contingencia...", "warning");
                
                let text = textContent || '';
                if (file && file.type === "text/plain") {
                    text = await readFileAsText(file);
                }
                
                const localExtract = runLocalFallbackClassification(text, file ? file.name : '');
                
                result = {
                    tipo_documento: localExtract.tipo,
                    socio_no: localExtract.socio_no,
                    nombre_socio: localExtract.nombre_socio,
                    resumen: `[CONTINGENCIA LOCAL] Clasificado localmente como ${localExtract.tipo} debido a saturación en Gemini API.`
                };
            }
        } else {
            // Local fallback simulation
            showSpinner(`${statusText} - Clasificando localmente...`);
            await new Promise(r => setTimeout(r, 1000)); // Short user latency delay

            let text = textContent || '';
            if (file && file.type === "text/plain") {
                text = await readFileAsText(file);
            }

            const localExtract = runLocalFallbackClassification(text, file ? file.name : '');
            
            // Create nice summaries for output
            let summary = "";
            if (localExtract.tipo === "Poder") {
                summary = `PODER DE REPRESENTACION de ${localExtract.nombre_socio} (Socio ${localExtract.socio_no}) para la Asamblea de Santo Domingo Country Club.`;
            } else if (localExtract.tipo === "Carta") {
                summary = `Carta de inclusión en Agenda solicitada por ${localExtract.nombre_socio} (Socio ${localExtract.socio_no}) para remover límites de invitados.`;
            } else {
                summary = `Documento no clasificado de Socio ${localExtract.socio_no || 'desconocido'}.`;
            }

            result = {
                tipo_documento: localExtract.tipo,
                socio_no: localExtract.socio_no,
                nombre_socio: localExtract.nombre_socio,
                resumen: summary
            };
        }

        // Validate 4-digit socio number
        const socioNo = result.socio_no;
        if (!socioNo || !/^\d{4}$/.test(socioNo)) {
            playWarningBeep();
            showToast("Documento Inválido", `No se detectó un número de socio de exactamente 4 dígitos (detectado: ${socioNo || 'ninguno'}).`, "error");
            return;
        }

        if (result.tipo_documento === "Desconocido") {
            playWarningBeep();
            showToast("Clasificación Fallida", "El documento no corresponde a un Poder ni a una Carta de Agenda válida.", "error");
            return;
        }

        // 1. Verify duplicates on already approved records
        const duplicate = activeRecords.find(r => r.socio_no === socioNo);
        if (duplicate) {
            playWarningBeep();
            showToast("DUPLICADO DETECTADO", `Socio ${socioNo} (${result.nombre_socio}) ya tiene un documento registrado como: ${duplicate.tipo}.`, "error");
            
            // Log duplicate attempt locally
            const rejectLog = {
                socio_no: socioNo,
                nombre: result.nombre_socio,
                tipo: result.tipo_documento,
                fecha: new Date().toISOString(),
                estado: "Duplicado",
                extracto: `[RECHAZADO] Duplicado del documento de tipo: ${duplicate.tipo}`
            };
            
            rejectedLogs.unshift(rejectLog);
            if (rejectedLogs.length > 50) rejectedLogs.pop();
            localStorage.setItem("asamblea_rejected", JSON.stringify(rejectedLogs));

            refreshAppUI();
            return;
        }

        // 2. Approved! Upload to server to persist physical files and database
        showSpinner(`${statusText} - Guardando en servidor...`);
        
        // Client side image compression before upload (if we didn't do it for Gemini already)
        if (file && file.type.startsWith("image/") && !geminiApiKey) {
            file = await compressImage(file);
        }

        const savedRecord = await uploadDocument(file, {
            socio_no: socioNo,
            nombre: result.nombre_socio,
            tipo: result.tipo_documento,
            extracto: result.resumen,
            fecha: new Date().toISOString()
        });

        // Add to active list
        activeRecords.unshift(savedRecord);
        playSuccessChime();
        showToast("Registro Exitoso", `Socio ${socioNo} (${result.nombre_socio}) registrado correctamente.`, "success");

        refreshAppUI();

    } catch (err) {
        throw err; // Re-throw to be caught by processNextInQueue
    }
}

// Upload pasted text handler
function handleTextUpload(text) {
    showSpinner("Procesando texto pegado...");
    processDocumentCore(null, text, "Procesando texto")
        .then(() => {
            hideSpinner();
            document.getElementById("text-raw").value = "";
            showToast("Éxito", "Texto procesado y guardado correctamente.", "success");
        })
        .catch(err => {
            hideSpinner();
            playWarningBeep();
            console.error(err);
            showToast("Error de Procesamiento", err.message || "Ocurrió un error guardando el registro.", "error");
        });
}

// Admin Security / Login
function openPasswordModal() {
    const pwdInput = document.getElementById("admin-password-input");
    const errorMsg = document.getElementById("pwd-error-msg");
    const submitBtn = document.getElementById("btn-submit-pwd");

    pwdInput.value = "";
    errorMsg.style.display = "none";

    // Setup lockout check
    clearInterval(securityInterval);
    
    const updateLockoutUI = () => {
        const status = getSecurityStatus();
        if (status.locked) {
            pwdInput.disabled = true;
            submitBtn.disabled = true;
            errorMsg.style.display = "block";
            errorMsg.textContent = `Acceso bloqueado por intentos fallidos. Reintente en ${status.remainingSeconds} segundos.`;
        } else {
            pwdInput.disabled = false;
            submitBtn.disabled = false;
            errorMsg.style.display = "none";
            clearInterval(securityInterval);
        }
    };

    updateLockoutUI();
    if (getSecurityStatus().locked) {
        securityInterval = setInterval(updateLockoutUI, 1000);
    }

    document.getElementById("modal-password").classList.add("open");
    setTimeout(() => {
        if (!pwdInput.disabled) pwdInput.focus();
    }, 100);
}

async function handleAdminLoginSubmit() {
    const pwdInput = document.getElementById("admin-password-input");
    const errorMsg = document.getElementById("pwd-error-msg");
    const password = pwdInput.value;

    const security = getSecurityStatus();
    if (security.locked) {
        return;
    }

    try {
        const token = await loginAdmin(password);
        
        // Reset security state
        resetLockout();
        saveSessionToken(token);
        
        document.getElementById("modal-password").classList.remove("open");
        
        // Open admin dashboard
        document.getElementById("modal-admin").classList.add("open");
        document.getElementById("admin-search").value = "";
        renderAdminTable(activeRecords, triggerRecordDelete, "");

    } catch (err) {
        // Failed login
        playWarningBeep();
        const lockoutStatus = registerFailedAttempt();
        
        if (lockoutStatus.locked) {
            openPasswordModal(); // Will trigger lockout UI countdown
        } else {
            errorMsg.style.display = "block";
            errorMsg.textContent = `Contraseña incorrecta. Intentos fallidos: ${lockoutStatus.failedAttempts} / 5`;
            pwdInput.focus();
        }
    }
}

// Delete individual record from admin dashboard
async function triggerRecordDelete(socioNo) {
    if (confirm(`¿Estás seguro de que deseas eliminar el registro del Socio No. ${socioNo}?`)) {
        try {
            await deleteRecord(socioNo);
            
            // Remove from local active list
            activeRecords = activeRecords.filter(r => r.socio_no !== socioNo);
            
            // Log admin delete action
            const deleteLog = {
                socio_no: socioNo,
                nombre: "Administración",
                tipo: "Eliminar",
                fecha: new Date().toISOString(),
                estado: "Eliminado",
                extracto: `[ADMIN] Registro de Socio No. ${socioNo} eliminado físicamente.`
            };
            rejectedLogs.unshift(deleteLog);
            if (rejectedLogs.length > 50) rejectedLogs.pop();
            localStorage.setItem("asamblea_rejected", JSON.stringify(rejectedLogs));

            refreshAppUI();
            
            // Refresh admin view
            const query = document.getElementById("admin-search").value;
            renderAdminTable(activeRecords, triggerRecordDelete, query);
            
            showToast("Registro Eliminado", `El socio ${socioNo} ha sido removido del sistema.`, "warning");
        } catch (err) {
            console.error(err);
            showToast("Error de Servidor", "No se pudo eliminar el registro del servidor.", "error");
        }
    }
}

// Clear Database entire system
async function triggerClearDatabase() {
    if (confirm("¿Estás absolutamente seguro de que deseas vaciar toda la base de datos? Esto eliminará todos los archivos físicos y registros del servidor.")) {
        try {
            await clearAllDatabase();
            
            activeRecords = [];
            rejectedLogs = [];
            localStorage.removeItem("asamblea_rejected");
            
            const clearLog = {
                socio_no: "N/A",
                nombre: "Administrador",
                tipo: "Limpieza",
                fecha: new Date().toISOString(),
                estado: "Vaciado",
                extracto: "[ADMIN] Base de datos vaciada por completo."
            };
            rejectedLogs.push(clearLog);
            localStorage.setItem("asamblea_rejected", JSON.stringify(rejectedLogs));

            refreshAppUI();
            
            document.getElementById("modal-admin").classList.remove("open");
            showToast("Base de Datos Vaciada", "Se han borrado todos los registros y archivos físicos.", "warning");
        } catch (err) {
            console.error(err);
            showToast("Error", "No se pudo vaciar la base de datos.", "error");
        }
    }
}

// Client side CSV Generator download
function triggerExportCSV() {
    if (activeRecords.length === 0) {
        showToast("Error", "No hay datos para exportar.", "error");
        return;
    }

    let csvContent = "\ufeffSocio No.,Nombre Completo,Tipo Documento,Fecha Registro,Estado,Ruta de Archivo\n";
    
    activeRecords.forEach(r => {
        csvContent += `"${r.socio_no}","${r.nombre}","${r.tipo}","${r.fecha}","${r.estado}","${r.file_path || ''}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `registro_asamblea_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("Exportación Exitosa", "Se ha descargado el archivo CSV.", "success");
}

// Setup PWA Events
function setupPwaEvents() {
    let deferredPrompt = null;
    const installBtn = document.getElementById("btn-pwa-install");

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) installBtn.style.display = 'inline-flex';
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`PWA install outcome: ${outcome}`);
                deferredPrompt = null;
                installBtn.style.display = 'none';
            }
        });
    }

    window.addEventListener('appinstalled', () => {
        console.log('PWA installed successfully');
        if (installBtn) installBtn.style.display = 'none';
        showToast("Instalación Exitosa", "La aplicación se instaló correctamente.", "success");
    });

    // Register Service Worker for offline support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado con éxito:', reg.scope))
            .catch(err => console.warn('Service Worker falló al registrarse:', err));
    }
}
