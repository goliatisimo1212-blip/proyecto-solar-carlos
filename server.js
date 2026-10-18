const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Inicialización de la Base de Datos SQLite
const dbPath = path.join(__dirname, 'leads_solares.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('Conectado exitosamente a la base de datos SQLite:', dbPath);
    }
});

// Creación de tabla de Leads
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            empresa TEXT NOT NULL,
            email TEXT NOT NULL,
            telefono TEXT NOT NULL,
            factura_mensual REAL NOT NULL,
            kw_estimados REAL,
            ahorro_anual REAL,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

// Endpoint API para recibir leads desde index.html
app.post('/api/leads', (req, res) => {
    const { nombre, empresa, email, telefono, factura_mensual, kw_estimados, ahorro_anual } = req.body;

    if (!nombre || !email || !factura_mensual) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const sql = `INSERT INTO leads (nombre, empresa, email, telefono, factura_mensual, kw_estimados, ahorro_anual)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [nombre, empresa, email, telefono, factura_mensual, kw_estimados, ahorro_anual];

    db.run(sql, params, function (err) {
        if (err) {
            console.error('Error al insertar lead:', err.message);
            return res.status(500).json({ error: 'Error al registrar el lead' });
        }
        res.json({ success: true, id: this.lastID, message: 'Lead registrado exitosamente' });
    });
});

// Endpoint API para listar leads en admin.html
app.get('/api/leads', (req, res) => {
    db.all('SELECT * FROM leads ORDER BY fecha DESC', [], (err, rows) => {
        if (err) {
            console.error('Error al obtener leads:', err.message);
            return res.status(500).json({ error: 'Error al consultar leads' });
        }
        res.json(rows);
    });
});

// Ruta principal para index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor solar ejecutándose en el puerto ${PORT}`);
});
