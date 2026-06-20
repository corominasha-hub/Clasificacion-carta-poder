/**
 * SocioCheck AI - DB & Backend API Communication Module
 */

const API_BASE = '/api';

export async function fetchRecords() {
    try {
        const response = await fetch(`${API_BASE}/records`);
        if (!response.ok) {
            throw new Error(`HTTP Error! Status: ${response.status}`);
        }
        const data = await response.json();
        return data.records || [];
    } catch (error) {
        console.error("Failed to fetch records from backend:", error);
        throw error;
    }
}

export async function uploadDocument(file, metadata) {
    try {
        const formData = new FormData();
        
        // Append all metadata fields first so that they are parsed before the file in Multer
        formData.append('socio_no', metadata.socio_no);
        formData.append('nombre', metadata.nombre);
        formData.append('tipo', metadata.tipo);
        formData.append('extracto', metadata.extracto || '');
        formData.append('fecha', metadata.fecha || new Date().toISOString());

        if (file) {
            formData.append('document', file);
        }

        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP Error! Status: ${response.status}`);
        }

        const data = await response.json();
        return data.record;
    } catch (error) {
        console.error("Upload document failed:", error);
        throw error;
    }
}

export async function deleteRecord(socioNo) {
    try {
        const response = await fetch(`${API_BASE}/records/${socioNo}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP Error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Failed to delete record ${socioNo}:`, error);
        throw error;
    }
}

export async function loginAdmin(password) {
    try {
        const response = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP Error! Status: ${response.status}`);
        }

        const data = await response.json();
        return data.token;
    } catch (error) {
        console.error("Admin login failed:", error);
        throw error;
    }
}

export async function clearAllDatabase() {
    try {
        const response = await fetch(`${API_BASE}/clear`, {
            method: 'POST'
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP Error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Clear database failed:", error);
        throw error;
    }
}
