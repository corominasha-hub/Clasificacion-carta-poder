const fs = require('fs');
const path = require('path');

class DBManager {
    constructor() {
        this.dbPath = path.join(__dirname, 'data.json');
        this.backupDir = path.join(__dirname, 'backups');
        
        // Initialize file if not exists
        if (!fs.existsSync(this.dbPath)) {
            this.writeRaw([]);
        }

        // Initialize backup directory
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }

        // Start automatic backup timer (every 30 minutes)
        setInterval(() => this.createBackup(), 30 * 60 * 1000);
    }

    // Read all records
    read() {
        try {
            if (!fs.existsSync(this.dbPath)) {
                return [];
            }
            const content = fs.readFileSync(this.dbPath, 'utf8');
            return JSON.parse(content || '[]');
        } catch (error) {
            console.error("Error reading database:", error);
            return [];
        }
    }

    // Atomic write to avoid file corruption
    writeRaw(data) {
        const tmpPath = `${this.dbPath}.tmp`;
        try {
            fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
            fs.renameSync(tmpPath, this.dbPath);
            return true;
        } catch (error) {
            console.error("Error performing atomic write:", error);
            if (fs.existsSync(tmpPath)) {
                try { fs.unlinkSync(tmpPath); } catch (_) {}
            }
            return false;
        }
    }

    // Add a record
    add(record) {
        const records = this.read();
        
        // Double check duplicates: reject only if there is a duplicate of the same type
        // Ignore duplicate check for pending records (PEND_XXXX)
        const isPending = record.socio_no && record.socio_no.startsWith("PEND_");
        const exists = !isPending && records.some(r => r.socio_no === record.socio_no && r.tipo === record.tipo);
        if (exists) {
            return { success: false, error: `Socio ${record.socio_no} ya tiene un documento de tipo ${record.tipo} registrado.` };
        }

        records.unshift(record);
        const success = this.writeRaw(records);
        return { success };
    }

    // Delete a record
    delete(socioNo, tipo) {
        const records = this.read();
        let filtered;
        if (tipo) {
            filtered = records.filter(r => !(r.socio_no === socioNo && r.tipo === tipo));
        } else {
            filtered = records.filter(r => r.socio_no !== socioNo);
        }
        
        if (records.length === filtered.length) {
            return { success: false, error: 'Registro no encontrado.' };
        }

        const success = this.writeRaw(filtered);
        return { success };
    }

    // Clear all records
    clear() {
        return this.writeRaw([]);
    }

    // Create automatic backup
    createBackup() {
        try {
            const records = this.read();
            if (records.length === 0) return; // Don't backup empty state if it was cleared

            const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.backupDir, `backup_${dateStr}.json`);
            
            fs.writeFileSync(backupFile, JSON.stringify(records, null, 2), 'utf8');
            console.log(`[Backup] Copia de seguridad guardada: ${backupFile}`);

            // Keep only the last 10 backups to save space
            this.rotateBackups();
        } catch (error) {
            console.error("Error creating database backup:", error);
        }
    }

    // Keep only last 10 backup files
    rotateBackups() {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter(file => file.startsWith('backup_') && file.endsWith('.json'))
                .map(file => ({
                    name: file,
                    time: fs.statSync(path.join(this.backupDir, file)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time); // Newest first

            if (files.length > 10) {
                const toDelete = files.slice(10);
                toDelete.forEach(file => {
                    fs.unlinkSync(path.join(this.backupDir, file.name));
                    console.log(`[Backup] Rotado y eliminado backup antiguo: ${file.name}`);
                });
            }
        } catch (error) {
            console.error("Error rotating backups:", error);
        }
    }
}

module.exports = new DBManager();
