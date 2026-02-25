import express from "express";
import bodyParser from "body-parser";
import { google } from "googleapis";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

/* =========================
   CLOUDINARY CONFIG
========================= */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* =========================
   WEBHOOK MENSAJES ENTRANTES
========================= */

app.post("/webhook", async (req, res) => {
  try {
    const body = req.body.Body || "";
    const from = req.body.From;
    const profile = req.body.ProfileName || "";
    const sid = req.body.MessageSid;
    const status = req.body.SmsStatus || "recibido";
    const numMedia = parseInt(req.body.NumMedia || "0");

    let imageUrl = "";

    console.log("📩 Mensaje entrante:", { from, profile, body, numMedia });

    // 📸 Si viene imagen
    if (numMedia > 0) {
      const mediaUrl = req.body.MediaUrl0;

      const mediaResponse = await axios.get(mediaUrl, {
        responseType: "arraybuffer",
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
      });

      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "twilio_whatsapp" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        streamifier
          .createReadStream(mediaResponse.data)
          .pipe(uploadStream);
      });

      imageUrl = uploadResult.secure_url;
    }

    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "repartidores!A:H",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
          from,
          profile,
          body,
          sid,
          "recibido",
          "entrante",
          imageUrl
        ]],
      },
    });

    res.set("Content-Type", "text/xml");
    res.send("<Response></Response>");

  } catch (error) {
    console.error("❌ Error con webhook de entrada:", error);
    res.send("<Response></Response>");
  }
});


/* =========================
   STATUS CALLBACK (SALIENTES)
========================= */

app.post("/status", async (req, res) => {
  try {
    const sid = req.body.MessageSid;
    const status = req.body.MessageStatus;
    const body = req.body.Body || "";
    const from = req.body.From;
    const to = req.body.To;

    const date = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "repartidores!A:H",
    });

    const rows = readRes.data.values || [];
    const sidIndex = 4;

    const rowNumber = rows.findIndex(r => r[sidIndex] === sid);

    if (rowNumber === -1 && body && !body.includes("Recibido gracias 🌸")) {

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "repartidores!A:H",
        valueInputOption: "RAW",
        requestBody: {
          values: [[date, from, to, body, sid, status, "saliente", ""]],
        },
      });

    } else if (rowNumber >= 0) {

      const targetRow = rowNumber + 1;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `repartidores!F${targetRow}`,
        valueInputOption: "RAW",
        requestBody: { values: [[status]] },
      });
    }

    res.sendStatus(200);

  } catch (error) {
    console.error("❌ Error en callback:", error);
    res.sendStatus(500);
  }
});


app.listen(3000, () => console.log("🚀 Servidor en puerto 3000"));






