import express from "express";
import bodyParser from "body-parser";
import { google } from "googleapis";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// ✅ Verificación simple
app.get("/", (req, res) => {
  res.send("🌸 Servidor activo. Esperando mensajes de Twilio...");
});

// ✅ Webhook: mensajes entrantes desde WhatsApp
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body.Body;
    const from = req.body.From;
    const profile = req.body.ProfileName || "";
    const sid = req.body.MessageSid || req.body.SmsSid || "sin_sid";
    const status = req.body.SmsStatus || "recibido";

    console.log("📩 Mensaje recibido:", { from, profile, body, sid, status });

    // Autenticación con Google Sheets
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Guardar el mensaje recibido
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "repartidores!A:F",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
          from,
          profile,
          body,
          sid,
          status
        ]],
      },
    });

    // Responder a Twilio (MUST be XML)
    res.set("Content-Type", "text/xml");
    res.send(`
      <Response>
        <Message>Recibido gracias 🌸</Message>
      </Response>
    `);

  } catch (error) {
    console.error("❌ Error guardando mensaje:", error);
    res.set("Content-Type", "text/xml");
    res.send(`
      <Response>
        <Message>Error al guardar en Sheets ❗</Message>
      </Response>
    `);
  }
});

// ✅ Webhook: actualiza estado de mensajes (en lugar de agregar fila nueva)
app.post("/status", async (req, res) => {
  try {
    const sid = req.body.MessageSid;
    const status = req.body.MessageStatus;
    console.log(`📤 Estado actualizado: ${sid} -> ${status}`);

    // Autenticación con Sheets
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Leer todas las filas para encontrar el SID
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "repartidores!A:F",
    });

    const rows = readRes.data.values || [];
    const sidIndex = 4; // Columna E (índice 4, empezando desde 0)
    const statusIndex = 5; // Columna F

    // Buscar el SID
    const rowNumber = rows.findIndex(r => r[sidIndex] === sid);
    if (rowNumber === -1) {
      console.warn("⚠️ SID no encontrado en la hoja:", sid);
      return res.sendStatus(200);
    }

    const targetRow = rowNumber + 1; // +1 porque la hoja empieza en 1
    const cell = `F${targetRow}`; // Columna F (estado)

    // Actualizar estado en la hoja
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `repartidores!${cell}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[status]],
      },
    });

    console.log(`✅ Estado actualizado en fila ${targetRow}: ${status}`);
    res.sendStatus(200);

  } catch (error) {
    console.error("❌ Error actualizando estado:", error);
    res.sendStatus(500);
  }
});

app.listen(3000, () => console.log("🚀 Servidor activo en puerto 3000"));





