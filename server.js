const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');

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

// Configuración del servicio de correo de notificaciones
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'goliatisimo1212@gmail.com',
        pass: process.env.EMAIL_PASS || '' // Se configura mediante variable de entorno en Render
    }
});

// Función para enviar correo de notificación al Administrador (Carlos Hoyos)
async function enviarNotificacionAdmin(lead) {
    if (!process.env.EMAIL_PASS) {
        console.log('Aviso: EMAIL_PASS no configurado. Notificación por correo omitida.');
        return;
    }

    const mailOptions = {
        from: '"Sistema Solar Carlos" <goliatisimo1212@gmail.com>',
        to: 'goliatisimo1212@gmail.com',
        subject: `🚨 ¡Nuevo Lead Solar Captado!: ${lead.empresa}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc; border-radius: 10px;">
                <h2 style="color: #f59e0b; margin-top: 0;">¡Nuevo Prospecto Interesado en Energía Solar!</h2>
                <p>Se ha registrado un nuevo lead a través de la calculadora web pública:</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; color: #cbd5e1;">
                    <tr><td style="padding: 8px; border-bottom: 1px solid #334155;"><strong>Cliente:</strong></td><td style="padding: 8px; border-bottom: 1px solid #334155; color: #ffffff;">${lead.nombre}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #334155;"><strong>Empresa:</strong></td><td style="padding: 8px; border-bottom: 1px solid #334155; color: #ffffff;">${lead.empresa}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #334155;"><strong>Correo:</strong></td><td style="padding: 8px; border-bottom: 1px solid #334155; color: #38bdf8;">${lead.email}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #334155;"><strong>Teléfono:</strong></td><td style="padding: 8px; border-bottom: 1px solid #334155; color: #ffffff;">${lead.telefono}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #334155;"><strong>Factura Mensual:</strong></td><td style="padding: 8px; border-bottom: 1px solid #334155; color: #f59e0b; font-weight: bold;">$${Number(lead.factura_mensual).toLocaleString('es-CO')} COP</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #334155;"><strong>Potencia Estimada:</strong></td><td style="padding: 8px; border-bottom: 1px solid #334155; color: #ffffff;">${lead.kw_estimados} kWp</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #334155;"><strong>Ahorro Anual Est.:</strong></td><td style="padding: 8px; border-bottom: 1px solid #334155; color: #10b981; font-weight: bold;">$${Number(lead.ahorro_anual).toLocaleString('es-CO')} COP</td></tr>
                </table>

                <div style="margin-top: 25px; text-align: center;">
                    <a href="https://proyecto-solar-carlos.onrender.com/admin.html" style="background-color: #f59e0b; color: #0f172a; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block;">
                        Ver Lead en el Panel de Administración
                    </a>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Notificación por correo enviada exitosamente a Carlos Hoyos.');
    } catch (err) {
        console.error('Error al enviar correo de notificación:', err.message);
    }
}

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
        
        const nuevoLead = { id: this.lastID, nombre, empresa, email, telefono, factura_mensual, kw_estimados, ahorro_anual };
        
        // Disparar notificación asíncrona por correo
        enviarNotificacionAdmin(nuevoLead);

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
    console.log(`Servidor solar v6.1.0 ejecutándose en el puerto ${PORT}`);
});
