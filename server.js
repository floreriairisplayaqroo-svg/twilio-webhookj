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
    console.log("📩 Mensaje recibido:", body, from, profile);

    // Autenticación con Google Sheets
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Hoja1!A:D",
      valueInputOption: "RAW",
      requestBody: {
        values: [[new Date().toLocaleString(), from, profile, body]],
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



