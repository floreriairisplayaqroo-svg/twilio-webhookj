import express from "express";
import fetch from "node-fetch";
import { google } from "googleapis";

const app = express();
app.use(express.urlencoded({ extended: true }));

// Autenticación con Google Sheets
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// Tu ID de hoja
const SPREADSHEET_ID = "1fR25botMIDeL113qMqvLnD1rBjbkZ9c5G6cWuNbgoAs";
const SHEET_NAME = "repartidores";

// Webhook de Twilio
app.post("/twilio", async (req, res) => {
  try {
    const data = req.body;
    console.log("Datos recibidos:", data);

    // Extrae los datos
    const fecha = new Date().toLocaleString("es-MX", { timeZone: "America/Cancun" });
    const from = data.From || "";
    const nombre = data.ProfileName || "";
    const mensaje = data.Body || "";
    const sid = data.MessageSid || "";
    const estado = data.SmsStatus || "";

    // Guarda en Google Sheets
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:F`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[fecha, from, nombre, mensaje, sid, estado]],
      },
    });

    // Responde a Twilio
    res
      .type("text/xml")
      .send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>✅ Recibido y guardado!</Message></Response>'
      );
  } catch (err) {
    console.error("Error:", err);
    res
      .type("text/xml")
      .send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>❌ Error al guardar</Message></Response>'
      );
  }
});

app.listen(3000, () => console.log("Servidor escuchando en puerto 3000"));



