import express from "express";
import bodyParser from "body-parser";
import { google } from "googleapis";

const app = express();

// ⚙️ Configuración general
app.use(bodyParser.urlencoded({ extended: false })); // ← mejor "false" para Twilio
app.use(bodyParser.json());

// ✅ Ruta base
app.get("/", (req, res) => {
  res.send("🌸 Servidor activo. Esperando mensajes de Twilio...");
});

// ✅ MENSAJES ENTRANTES (Webhook principal)
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body.Body;
    const from = req.body.From;
    const profile = req.body.ProfileName || "";
    const sid = req.body.MessageSid || req.body.SmsSid || "sin_sid";
    const status = req.body.SmsStatus || "recibido";

    console.log("📩 Mensaje recibido:");
    console.log("Texto:", body);
    console.log("De:", from);
    console.log("Perfil:", profile);
    console.log("SID:", sid);
    console.log("Estado:", status);

    // 🔐 Autenticación con Google Sheets
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // 📝 Guardar datos en hoja "repartidores"
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "repartidores!A:F", // no necesitas G si solo guardas 6 columnas
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

    // 📩 Responder a Twilio (MUST be XML)
    res.set("Content-Type", "text/xml");
    res.send(`
      <Response>
        <Message>Recibido gracias 🌸</Message>
      </Response>
    `);

  } catch (error) {
    console.error("❌ Error guardando en Sheets:", error);
    res.set("Content-Type", "text/xml");
    res.send(`
      <Response>
        <Message>Error al guardar en Sheets ❗</Message>
      </Response>
    `);
  }
});

// ✅ ESTADOS DE MENSAJES SALIENTES (Delivery Callback)
app.post("/status", async (req, res) => {
  try {
    const sid = req.body.MessageSid;
    const status = req.body.MessageStatus;
    const to = req.body.To;
    const from = req.body.From;
    const body = req.body.Body || "";
    const date = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

    console.log(`📤 Estado actualizado: ${sid} -> ${status}`);

    // 🔐 Autenticación con Google Sheets
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // 📝 Guardar en hoja "enviados"
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "enviados!A:F",
      valueInputOption: "RAW",
      requestBody: {
        values: [[date, from, to, body, sid, status]],
      },
    });

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error guardando estado de mensaje:", error);
    res.sendStatus(500);
  }
});

// 🚀 Iniciar servidor
app.listen(3000, () => console.log("🚀 Servidor activo en puerto 3000"));






