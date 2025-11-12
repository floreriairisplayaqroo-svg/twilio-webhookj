import express from "express";
import bodyParser from "body-parser";
import { google } from "googleapis";

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("🌸 Servidor activo. Esperando mensajes de Twilio...");
});

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

    // --- Autenticación con Google Sheets ---
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

   const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // --- Guardar todos los datos en Sheets ---
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
          status
        ]],
      },
    });

    // Responder a Twilio con XML
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

app.listen(3000, () => console.log("🚀 Servidor activo en puerto 3000"));






