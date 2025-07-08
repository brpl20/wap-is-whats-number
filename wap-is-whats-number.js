const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const app = express();
app.use(express.json());

// Initialize the WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("error", (error) => {
  console.error("An error occurred:", error);
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.initialize();

function formatPhoneForWhatsApp(phone) {
  if (!phone) return "N/A";
  if (phone.length === 11) {
    let cleanPhone = phone.replace(/\D/g, "");
    let areaCode = cleanPhone.slice(0, 2);
    let mainNumber = cleanPhone.slice(3);
    let result = `55${areaCode}${mainNumber}@c.us`;
    console.log("Final result:", result);
    return result;
  } else {
    let cleanPhone = phone.replace(/\D/g, "");
    let result = `55${cleanPhone}@c.us`;
    console.log("Final result:", result);
    return result;
  }
}

// Check if a WhatsApp contact is registered
async function checkWhatsAppContact(whatsappId) {
  try {
    return await client.isRegisteredUser(whatsappId);
  } catch (error) {
    console.error(`Error checking contact ${whatsappId}:`, error);
    return false;
  }
}

// Endpoint to check if a single phone number is registered on WhatsApp
app.post("/checkSingleWhatsApp", async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required." });
  }

  const whatsappId = formatPhoneForWhatsApp(phoneNumber);
  if (whatsappId === "N/A") {
    return res.json({ phoneNumber, isValidWhatsApp: false });
  }

  const isValidWhatsApp = await checkWhatsAppContact(whatsappId);
  res.json({ phoneNumber, isValidWhatsApp });
});

// Endpoint to check if multiple phone numbers are registered on WhatsApp
app.post("/checkWhatsApp", async (req, res) => {
  const { phoneNumbers } = req.body;
  if (!Array.isArray(phoneNumbers)) {
    return res
      .status(400)
      .json({ error: "Invalid input, expected an array of phone numbers." });
  }

  const results = await Promise.all(
    phoneNumbers.map(async (phone) => {
      const whatsappId = formatPhoneForWhatsApp(phone);
      if (whatsappId === "N/A") {
        return { phone, isValidWhatsApp: false };
      }
      const isValidWhatsApp = await checkWhatsAppContact(whatsappId);
      return { phone, isValidWhatsApp };
    }),
  );

  res.json(results);
});

// Endpoint to check the API status Health
app.get("/getStatus", async (req, res) => {
  try {
    const estado = await client.getState();
    res.status(200).json({ Sucesso: true, estado });
  } catch (error) {
    res.status(500).json({ Sucesso: false, error: error.message });
  }
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
