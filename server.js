import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.urlencoded({ extended: true }));

app.post("/twilio", async (req, res) => {
  try {
    await fetch("https://script.google.com/macros/s/AKfycbxCJr4_nmMOkbNx6D6TvpYlvUn0qV3pQay4tRWp476PMke0b5bR0HffzbvGGV8W0b8cGA/exec", {
      method: "POST",
      body: new URLSearchParams(req.body),
    });

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
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Error interno</Message></Response>'
      );
  }
});

app.get("/", (req, res) => res.send("Webhook activo 🟢"));

app.listen(3000, () => console.log("Servidor iniciado en puerto 3000"));
