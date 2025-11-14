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
app.post("/status", async (req, res) => {
  try {
    const sid = req.body.MessageSid;
    const status = req.body.MessageStatus; // sent, delivered, read
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
      range: "repartidores!A:G",
    });

    const rows = readRes.data.values || [];
    const sidIndex = 4;
    const rowNumber = rows.findIndex(r => r[sidIndex] === sid);

    // 📌 Si ya existe → solo actualiza estado y NO guarda otra vez
  // Si ya existe el SID → actualizar estado solo si cambió
if (rowNumber >= 0) {
  const targetRow = rowNumber + 1;
  const currentStatus = rows[rowNumber][5] || ""; // Columna F

  if (currentStatus === status) {
    console.log(`⏹ Ignorado: estado repetido (${status}) para SID ${sid}`);
    return res.sendStatus(200);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `repartidores!F${targetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [[status]] },
  });

  console.log(`🔄 Estado actualizado: ${currentStatus} → ${status}`);
  return res.sendStatus(200);
}


    // 📌 Si NO existe todavía → guardar SOLO si es el primer envío del mensaje
    const estadosPermitidosParaRegistrar = ["sent", "queued", "accepted"];
    if (!estadosPermitidosParaRegistrar.includes(status)) {
      console.log(`⛔ Ignorado: callback tardío (${status}) sin registro previo`);
      return res.sendStatus(200);
    }

    // Guardar nuevo mensaje saliente
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "repartidores!A:G",
      valueInputOption: "RAW",
      requestBody: {
        values: [[date, from, to, body, sid, status, "saliente"]],
      },
    });

    console.log(`🆕 Mensaje saliente guardado: ${body}`);

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error en status callback:", error);
    res.sendStatus(500);
  }
});



app.listen(3000, () => console.log("🚀 Servidor en puerto 3000"));









