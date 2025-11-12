import express from "express";
import bodyParser from "body-parser";
import { google } from "googleapis";

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post("/webhook", async (req, res) => {
  const body = req.body.Body;
  const from = req.body.From;
  const to = req.body.To;
  const profile = req.body.ProfileName;

  console.log("📩 Mensaje recibido:", body, from, profile);

  try {
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
        <Message>Error guardando en Sheets ❗</Message>
      </Response>
    `);
  }
});

app.listen(3000, () => console.log("🚀 Servidor activo en puerto 3000"));


