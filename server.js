import express from "express";
import bodyParser from "body-parser";
import { google } from "googleapis";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// ==========================
// 📩 WEBHOOK DE MENSAJES ENTRANTES
// ==========================
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body.Body;
    const from = req.body.From;
    const profile = req.body.ProfileName || "";
    const sid = req.body.MessageSid;

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

    // ⚠️ NO TwiML → evita que Twilio duplique mensajes
    return res.sendStatus(200);

  } catch (error) {
    console.error("❌ Error en webhook de entrada:", error);
    return res.sendStatus(200);
  }
});



// ==========================
// 🚀 SERVIDOR
// ==========================
app.listen(3000, () =>
  console.log("🚀 Servidor en puerto 3000")
);










