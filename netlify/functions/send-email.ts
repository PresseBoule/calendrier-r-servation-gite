const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const sendEmail = async (to: string, subject: string, html: string) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Les Gîtes du Soulor <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to send email to ${to}:`, err);
  }
  return res.ok;
};

export const handler = async (event: { httpMethod: string; body: string | null }) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  if (!RESEND_API_KEY) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: "RESEND_API_KEY not configured" }) };
  }

  let body: { clientName: string; clientEmail: string; date: string; slots: number[] };
  try {
    body = JSON.parse(event.body ?? "");
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { clientName, clientEmail, date, slots } = body;

  const slotsHtml = [...slots]
    .sort((a, b) => a - b)
    .map((hour) => {
      const endHour = hour === 23 ? "0h" : hour === 1 ? "2h" : `${hour + 1}h`;
      return `<li style="padding:4px 0">${hour}h00 – ${endHour}00</li>`;
    })
    .join("");

  await Promise.all([
    // Email au patron
    sendEmail(
      "spanazol@wanadoo.fr",
      `Nouvelle réservation – ${clientName}`,
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#c9a66b;border-bottom:2px solid #c9a66b;padding-bottom:10px">Nouvelle réservation Bain Nordique &amp; Sauna</h2>
        <p><strong>Client :</strong> ${clientName}</p>
        <p><strong>Email :</strong> ${clientEmail}</p>
        <p><strong>Date :</strong> ${date}</p>
        <p><strong>Créneaux :</strong></p>
        <ul style="background:#f4f4f4;padding:15px 15px 15px 35px;border-radius:5px">${slotsHtml}</ul>
        <p style="color:#888;font-size:12px;margin-top:20px">Réservation gratuite – comprise dans le prix du séjour.</p>
      </div>`
    ),
    // Email de confirmation au client
    sendEmail(
      clientEmail,
      "Confirmation de votre réservation – Les Gîtes du Soulor",
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#c9a66b;border-bottom:2px solid #c9a66b;padding-bottom:10px">Votre réservation est confirmée !</h2>
        <p>Bonjour <strong>${clientName}</strong>,</p>
        <p>Nous avons bien enregistré votre réservation du Bain Nordique &amp; Sauna aux Gîtes du Soulor.</p>
        <p><strong>Date :</strong> ${date}</p>
        <p><strong>Créneaux réservés :</strong></p>
        <ul style="background:#f4f4f4;padding:15px 15px 15px 35px;border-radius:5px">${slotsHtml}</ul>
        <p style="margin-top:20px">Cette réservation est gratuite et comprise dans le prix de votre séjour.<br>
        Contact : <a href="mailto:spanazol@wanadoo.fr">spanazol@wanadoo.fr</a></p>
        <p style="margin-top:30px">À bientôt aux Gîtes du Soulor !</p>
      </div>`
    ),
  ]);

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) };
};
