// Servidor Backend con Base de Datos SQLite y Generador PDF
// Versión: v2.4.0

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// Base de Datos Local SQLite
const dbFile = path.join(__dirname, 'leads_solares.db');
const db = new sqlite3.Database(dbFile);

// Crear tabla si no existe
db.run(`CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa TEXT NOT NULL,
    contacto_email TEXT NOT NULL,
    pago_mensual_cop REAL NOT NULL,
    ahorro_estimado_cop REAL NOT NULL,
    es_apto_capex TEXT NOT NULL,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 1. Guardar Lead
app.post('/api/v1/leads', (req, res) => {
    const { empresa, contacto_email, pago_mensual_cop } = req.body;
    if (!empresa || !contacto_email || !pago_mensual_cop) {
        return res.status(400).json({ exito: false, error: 'Faltan datos obligatorios.' });
    }
    const ahorroEstimado = pago_mensual_cop * 0.40;
    const esAptoCapex = pago_mensual_cop >= 5000000 ? 'APTO CAPEX CERO' : 'REQUIERE REVISIÓN';

    const query = `INSERT INTO leads (empresa, contacto_email, pago_mensual_cop, ahorro_estimado_cop, es_apto_capex) VALUES (?, ?, ?, ?, ?)`;
    db.run(query, [empresa, contacto_email, pago_mensual_cop, ahorroEstimado, esAptoCapex], function(err) {
        if (err) return res.status(500).json({ exito: false, error: 'Error en base de datos.' });
        return res.status(201).json({ exito: true, id: this.lastID });
    });
});

// 2. Listar Leads para el Admin
app.get('/api/v1/leads', (req, res) => {
    db.all(`SELECT * FROM leads ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al consultar datos.' });
        res.json(rows);
    });
});

// 3. Generar Propuesta Comercial en HTML descargable (Simulando PDF) para un Lead específico
app.get('/api/v1/leads/:id/pdf', (req, res) => {
    const leadId = req.params.id;
    db.get(`SELECT * FROM leads WHERE id = ?`, [leadId], (err, lead) => {
        if (err || !lead) {
            return res.status(404).send('Lead no encontrado.');
        }

        const htmlPropuesta = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Propuesta Comercial - ${lead.empresa}</title>
            <style>
                body { font-family: Arial, sans-serif; color: #1e293b; margin: 40px; line-height: 1.6; }
                .header { border-bottom: 2px solid #f59e0b; padding-bottom: 15px; margin-bottom: 25px; }
                .title { font-size: 22px; font-weight: bold; color: #0f172a; }
                .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-top: 15px; }
                .highlight { color: #d97706; font-weight: bold; }
                .btn { background: #f59e0b; color: #0f172a; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block; margin-top: 20px;}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">PROPUESTA DE VALOR: ENERGÍA SOLAR INDUSTRIAL</div>
                <div>Modelo CAPEX Cero & Beneficios Ley 1715 | Cliente: ${lead.empresa}</div>
            </div>
            <p>Estimado equipo de <strong>${lead.empresa}</strong>,</p>
            <p>Basado en su factura mensual promedio de <span class="highlight">$${lead.pago_mensual_cop.toLocaleString('es-CO')} COP</span>, su empresa califica para el programa de transición con instalación fotovoltaica sin inversión inicial.</p>
            
            <div class="box">
                <h3>Resumen Financiero y Tributario</h3>
                <p><strong>Ahorro anual estimado:</strong> $${(lead.ahorro_estimado_cop * 12).toLocaleString('es-CO')} COP</p>
                <p><strong>Deducción en Renta (Ley 1715):</strong> Hasta el 50% de la inversión deducible del impuesto de renta.</p>
                <p><strong>Estado de Viabilidad:</strong> ${lead.es_apto_capex}</p>
            </div>

            <a href="javascript:window.print();" class="btn">Imprimir / Guardar como PDF</a>
        </body>
        </html>
        `;
        res.send(htmlPropuesta);
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor v2.4.0 activo en http://localhost:${PORT}`));