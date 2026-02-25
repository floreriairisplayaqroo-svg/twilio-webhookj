import express from "express";
import bodyParser from "body-parser";
import { google } from "googleapis";
import axios from "axios";
import { Readable } from "stream";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

/* =====================================================
   📩 WEBHOOK MENSAJES ENTRANTES
===================================================== */

app.post("/webhook", async (req, res) => {
  try {
    const body = req.body.Body || "";
    const from = req.body.From;
    const profile = req.body.ProfileName || "";
    const sid = req.body.MessageSid;
    const status = req.body.SmsStatus || "recibido";
    const numMedia = parseInt(req.body.NumMedia || 0);

    console.log("📩 Entrante:", { from, body, numMedia });

    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const drive = google.drive({ version: "v3", auth });

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const folderId = process.env.DRIVE_FOLDER_ID;

    let imageLink = "";

    /* ===============================
       📸 SI EL MENSAJE TRAE IMAGEN
    =============================== */
    if (numMedia > 0) {
      const mediaUrl = req.body.MediaUrl0;
      const mediaType = req.body.MediaContentType0 || "image/jpeg";

      // Descargar imagen desde Twilio
      const response = await axios.get(mediaUrl, {
        responseType: "arraybuffer",
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
      });

      const bufferStream = new Readable();
      bufferStream.push(response.data);
      bufferStream.push(null);

      const extension = mediaType.split("/")[1] || "jpg";
      const fileName = `Twilio_${Date.now()}.${extension}`;

      // Subir a Drive (IMPORTANTE supportsAllDrives)
      const file = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
        },
        media: {
          mimeType: mediaType,
          body: bufferStream,
        },
        supportsAllDrives: true,
      });

      // Hacer público
      await drive.permissions.create({
        fileId: file.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
        supportsAllDrives: true,
      });

      imageLink = `https://drive.google.com/file/d/${file.data.id}/view`;
    }

    /* ===============================
       📊 GUARDAR EN SHEETS
    =============================== */
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
          status,
          "entrante",
          imageLink
        ]],
      },
    });

    res.set("Content-Type", "text/xml");
    res.send("<Response></Response>");

  } catch (error) {
    console.error("❌ Error webhook entrada:", error);
    res.send("<Response></Response>");
  }
});


/* =====================================================
   📦 STATUS CALLBACK MENSAJES SALIENTES
===================================================== */

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
    console.error("❌ Error en status callback:", error);
    res.sendStatus(500);
  }
});


/* ===================================================== */

app.listen(3000, () => console.log("🚀 Servidor en puerto 3000"));










