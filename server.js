import express from "express";
import bodyParser from "body-parser";
import { google } from "googleapis";
import twilio from "twilio";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// 📄 Webhook de Twilio (mensajes entrantes)
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body.Body;
    const from = req.body.From;
    const profile = req.body.ProfileName || "";
    const sid = req.body.MessageSid || req.body.SmsSid || "sin_sid";
    const status = req.body.SmsStatus || "recibido";

    console.log("📩 Mensaje entrante:", { from, profile, body, sid, status });

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
          status,
          "entrante"
        ]],
      },
    });

    res.set("Content-Type", "text/xml");
    res.send(`
      <Response>
        <Message>Recibido gracias 🌸</Message>
      </Response>
    `);

  } catch (error) {
    console.error("❌ Error guardando mensaje entrante:", error);
    res.set("Content-Type", "text/xml");
    res.send(`
      <Response>
        <Message>Error al guardar en Sheets ❗</Message>
      </Response>
    `);
  }
});

// 📦 Webhook de estado (statusCallback)
app.post("/status", async (req, res) => {
  try {
    const sid = req.body.MessageSid;
    const status = req.body.MessageStatus;
    const to = req.body.To;
    const from = req.body.From;
    const body = req.body.Body || "";
    const direction = req.body.Direction || "saliente";
    const date = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

    console.log(`📤 Estado actualizado (${direction}): ${sid} -> ${status}`);

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
    const typeIndex = 6; // Columna G

    // Buscar el SID en la hoja
    const rowNumber = rows.findIndex(r => r[sidIndex] === sid);
    if (rowNumber === -1) {
      console.log("🆕 Nuevo mensaje saliente detectado:", sid);
 // ✅ Consultamos el mensaje en Twilio para obtener el texto
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// Obtener mensaje saliente
const msgData = await twilioClient.messages(sid).fetch();
const bodyText = msgData.body || "(sin texto)";

      // No existe → lo guardamos como nuevo mensaje saliente
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "repartidores!A:G",
        valueInputOption: "RAW",
        requestBody: {
          values: [[date, from, to, body, sid, status, "saliente"]],
        },
      });
    } else {
      // Existe → actualizamos solo el estado
      const targetRow = rowNumber + 1;
      const cell = `F${targetRow}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `repartidores!${cell}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[status]],
        },
      });

      console.log(`✅ Estado actualizado en fila ${targetRow}: ${status}`);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error guardando estado o mensaje saliente:", error);
    res.sendStatus(500);
  }
});

app.listen(3000, () => console.log("🚀 Servidor activo en puerto 3000"));







