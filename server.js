import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.urlencoded({ extended: true }));

app.post("/twilio", async (req, res) => {
  try {
    // 🔍 Muestra lo que llega desde Twilio
    console.log("Datos recibidos desde Twilio:", req.body);

    // 📨 Convierte los datos a formato que Apps Script entiende
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.body)) {
      params.append(key, value);
    }

    // 🚀 Envía los datos al Apps Script
    const response = await fetch("https://script.google.com/macros/s/AKfycbxCJr4_nmMOkbNx6D6TvpYlvUn0qV3pQay4tRWp476PMke0b5bR0HffzbvGGV8W0b8cGA/exec", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    console.log("Respuesta de Apps Script:", await response.text());

    // 📩 Respuesta para Twilio (debe ser XML)
    res
      .type("text/xml")
      .send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>✅ Recibido, gracias!</Message></Response>'
      );
  } catch (err) {
    console.error("Error:", err);
    res
      .type("text/xml")
      .send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>❌ Error interno</Message></Response>'
      );
  }
});


app.get("/", (req, res) => res.send("Webhook activo 🟢"));

app.listen(3000, () => console.log("Servidor iniciado en puerto 3000"));

