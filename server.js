import express from "express";
import bodyParser from "body-parser";
import { google } from "googleapis";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// 📄 Webhook de mensajes ENTRANTES
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body.Body;
    const from = req.body.From;
    const profile = req.body.ProfileName || "";
    const sid = req.body.MessageSid;
    const status = req.body.SmsStatus || "recibido";

    console.log("📩 Mensaje entrante:", { from, profile, body });

    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "repartidores!A:G",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
          from,
          profile,
          body,
          sid,
          "recibido",
          "entrante"
        ]],
      },
    });

    // RESPUESTA SIN ENVIAR MENSAJE (para evitar duplicados)
    res.set("Content-Type", "text/xml");
    res.send("<Response></Response>");

  } catch (error) {
    console.error("❌ Error con webhook de entrada:", error);
    res.send("<Response></Response>");
  }
});


// 📦 Webhook statusCallback de Twilio (mensajes SALIENTES)
// 📦 Webhook de estado (statusCallback)
app.post("/status", async (req, res) => {
  try {
    const sid = req.body.MessageSid;
    const status = req.body.MessageStatus;
    const to = req.body.To;
    const from = req.body.From;
    const body = req.body.Body || "";
    const date = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

    console.log(`📤 Estado recibido: ${sid} -> ${status}`);

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
      range: "repartidores!A:G",
    });

    const rows = readRes.data.values || [];
    const sidIndex = 4; // Columna E
    const statusIndex = 5; // Columna F

    // Buscar el SID
    const rowNumber = rows.findIndex(r => r[sidIndex] === sid);

    // Si no existe → registrar mensaje saliente por primera vez
    if (rowNumber === -1) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "repartidores!A:G",
        valueInputOption: "RAW",
        requestBody: {
          values: [[date, from, to, body, sid, status, "saliente"]],
        },
      });

      console.log("🆕 Mensaje saliente guardado con estado:", status);
      return res.sendStatus(200); // no se devuelve XML
    }

    // Si existe → solo actualizar si el estado cambió
    const currentStatus = rows[rowNumber][statusIndex] || "";
    if (currentStatus === status) {
      console.log(`⏹ Ignorado: estado repetido (${status})`);
      return res.sendStatus(200);
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `repartidores!F${rowNumber + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[status]] },
    });

    console.log(`🔄 Estado actualizado ${currentStatus} → ${status}`);
    res.sendStatus(200);

  } catch (error) {
    console.error("❌ Error guardando estado:", error);
    res.sendStatus(500);
  }
});




app.listen(3000, () => console.log("🚀 Servidor en puerto 3000"));










