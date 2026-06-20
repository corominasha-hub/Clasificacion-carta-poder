const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const dbManager = require('./db_manager');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Name format: [SOCIO_NO]_[NOMBRE_FORMATEADO].[EXT]
        const socioNo = req.body.socio_no || 'sin_socio';
        const nombreRaw = req.body.nombre || 'usuario';
        const nombreClean = nombreRaw.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const ext = path.extname(file.originalname) || '.png';
        cb(null, `${socioNo}_${nombreClean}${ext}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper: Run Git Auto-Sincronización in background
function triggerGitSync(actionMessage) {
    console.log(`[Git Sync] Iniciando sincronización por: ${actionMessage}`);
    
    // Check if repo has remote configured
    exec('git remote', (remoteErr, remoteStdout) => {
        if (remoteErr || !remoteStdout.trim()) {
            console.log('[Git Sync] Ignorado: No hay repositorio remoto configurado.');
            return;
        }

        // Run git sync commands in background
        const command = `git add uploads/ data.json && git commit -m "GitSync: ${actionMessage}" && git push origin main`;
        exec(command, { cwd: __dirname }, (err, stdout, stderr) => {
            if (err) {
                console.error('[Git Sync Error]', err);
            } else {
                console.log('[Git Sync Success]', stdout);
            }
        });
    });
}

// 0. Get API configurations (e.g. Gemini key)
app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        gemini_api_key: process.env.GEMINI_API_KEY || ''
    });
});

// 1. Get all records
app.get('/api/records', (req, res) => {
    const records = dbManager.read();
    res.json({ success: true, records });
});

// 2. Upload Document & Register Member
app.post('/api/upload', upload.single('document'), (req, res) => {
    try {
        const { socio_no, nombre, tipo, extracto, fecha } = req.body;

        if (!socio_no || !/^\d{4}$/.test(socio_no)) {
            return res.status(400).json({ success: false, error: 'Número de socio inválido (debe tener exactamente 4 dígitos).' });
        }

        if (!nombre || !tipo) {
            return res.status(400).json({ success: false, error: 'Faltan campos requeridos (nombre o tipo).' });
        }

        // Check if file was uploaded, save file path
        let filePath = '';
        if (req.file) {
            filePath = `/uploads/${req.file.filename}`;
        }

        const newRecord = {
            socio_no,
            nombre,
            tipo,
            fecha: fecha || new Date().toISOString(),
            estado: 'Aprobado',
            extracto: extracto || `Documento clasificado como ${tipo}.`,
            file_path: filePath
        };

        const dbResult = dbManager.add(newRecord);

        if (!dbResult.success) {
            // If DB failed (e.g. duplicate), delete the uploaded file to avoid leaving orphan files
            if (req.file) {
                try { fs.unlinkSync(req.file.path); } catch (_) {}
            }
            return res.status(400).json({ success: false, error: dbResult.error || 'Error al guardar en base de datos.' });
        }

        // Trigger Git Sync in background
        triggerGitSync(`Registro Socio ${socio_no} (${nombre})`);

        res.json({ success: true, record: newRecord });

    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor al procesar la subida.' });
    }
});

// 3. Delete Record & File
app.delete('/api/records/:socio_no', (req, res) => {
    const { socio_no } = req.params;

    if (!socio_no) {
        return res.status(400).json({ success: false, error: 'Socio no. requerido.' });
    }

    const records = dbManager.read();
    const target = records.find(r => r.socio_no === socio_no);

    if (!target) {
        return res.status(404).json({ success: false, error: 'Socio no encontrado.' });
    }

    // Delete record from DB
    const dbResult = dbManager.delete(socio_no);

    if (dbResult.success) {
        // Delete physical file from filesystem if exists
        if (target.file_path) {
            const absoluteFilePath = path.join(__dirname, target.file_path);
            if (fs.existsSync(absoluteFilePath)) {
                try {
                    fs.unlinkSync(absoluteFilePath);
                    console.log(`[File Delete] Archivo físico eliminado: ${absoluteFilePath}`);
                } catch (err) {
                    console.error("Error deleting file:", err);
                }
            }
        }

        // Trigger Git Sync in background to reflect deletion on GitHub
        triggerGitSync(`Eliminado Socio ${socio_no}`);

        res.json({ success: true, message: 'Registro y archivos asociados eliminados correctamente.' });
    } else {
        res.status(500).json({ success: false, error: dbResult.error || 'Error al eliminar de base de datos.' });
    }
});

// 4. Admin Login Validation
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;

    if (password === 'country2026') {
        // Generate simple temporary token
        res.json({ success: true, token: 'session_token_country_2026' });
    } else {
        res.status(401).json({ success: false, error: 'Contraseña de administrador incorrecta.' });
    }
});

// 5. Clear entire Database & Uploads
app.post('/api/clear', (req, res) => {
    try {
        // 1. Clear database JSON file
        dbManager.clear();

        // 2. Delete all files in uploads directory
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
            try {
                fs.unlinkSync(path.join(uploadsDir, file));
            } catch (err) {
                console.error(`Error deleting file ${file}:`, err);
            }
        }

        // 3. Trigger Git Sync in background
        triggerGitSync('Vaciado completo de base de datos y archivos');

        res.json({ success: true, message: 'Base de datos y archivos físicos vaciados correctamente.' });

    } catch (error) {
        console.error("Clear error:", error);
        res.status(500).json({ success: false, error: 'Error al vaciar la base de datos.' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 SocioCheck AI iniciado en: http://localhost:${PORT}`);
    console.log(`📌 Almacenamiento local listo en: ${uploadsDir}`);
    console.log(`🔒 Clave de administrador: country2026`);
    console.log(`==================================================`);
});
