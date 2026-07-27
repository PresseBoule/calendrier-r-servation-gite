import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.ts";

const app = new Hono();

app.use('*', logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.get("/make-server-2b20b999/health", (c) => {
  return c.json({ status: "ok" });
});

app.get("/make-server-2b20b999/bookings", async (c) => {
  try {
    const bookings = await kv.getByPrefix("booking:");
    return c.json({ bookings: bookings || [] });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return c.json({ error: "Failed to fetch bookings", message: String(error) }, 500);
  }
});

app.post("/make-server-2b20b999/bookings", async (c) => {
  try {
    const body = await c.req.json();
    const { id, date, hour, clientName, clientEmail } = body;

    if (!id || !date || hour === undefined || !clientName || !clientEmail) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const booking = { id, date, hour, clientName, clientEmail };
    await kv.set(`booking:${id}`, booking);

    return c.json({ success: true, booking });
  } catch (error) {
    console.error("Error saving booking:", error);
    return c.json({ error: "Failed to save booking", message: String(error) }, 500);
  }
});

app.post("/make-server-2b20b999/send-booking-email", async (c) => {
  try {
    const body = await c.req.json();
    const { clientName, clientEmail, date, slots } = body;

    if (!clientName || !clientEmail || !date || !slots || slots.length === 0) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not set");
      return c.json({ error: "Email service not configured" }, 500);
    }

    const slotsHtml = slots
      .sort((a: number, b: number) => a - b)
      .map((hour: number) => {
        const endHour = hour === 23 ? "0h" : hour === 1 ? "2h" : `${hour + 1}h`;
        return `<li style="padding: 4px 0;">${hour}h00 – ${endHour}00</li>`;
      })
      .join("");

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

    // Email au patron
    await sendEmail(
      "spanazol@wanadoo.fr",
      `Nouvelle réservation Bain Nordique & Sauna – ${clientName}`,
      `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #c9a66b; border-bottom: 2px solid #c9a66b; padding-bottom: 10px;">
            Nouvelle réservation Bain Nordique &amp; Sauna
          </h2>
          <p><strong>Client :</strong> ${clientName}</p>
          <p><strong>Email :</strong> ${clientEmail}</p>
          <p><strong>Date :</strong> ${date}</p>
          <p><strong>Créneaux réservés :</strong></p>
          <ul style="background: #f4f4f4; padding: 15px 15px 15px 35px; border-radius: 5px;">
            ${slotsHtml}
          </ul>
          <p style="color: #888; font-size: 12px; margin-top: 20px;">
            Réservation gratuite – comprise dans le prix du séjour.
          </p>
        </div>
      `
    );

    // Email de confirmation au client
    await sendEmail(
      clientEmail,
      "Confirmation de votre réservation – Les Gîtes du Soulor",
      `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #c9a66b; border-bottom: 2px solid #c9a66b; padding-bottom: 10px;">
            Votre réservation est confirmée !
          </h2>
          <p>Bonjour <strong>${clientName}</strong>,</p>
          <p>Nous avons bien enregistré votre réservation du Bain Nordique &amp; Sauna aux Gîtes du Soulor.</p>
          <p><strong>Date :</strong> ${date}</p>
          <p><strong>Créneaux réservés :</strong></p>
          <ul style="background: #f4f4f4; padding: 15px 15px 15px 35px; border-radius: 5px;">
            ${slotsHtml}
          </ul>
          <p style="margin-top: 20px;">
            Cette réservation est gratuite et comprise dans le prix de votre séjour.<br>
            En cas de question, contactez-nous à <a href="mailto:spanazol@wanadoo.fr">spanazol@wanadoo.fr</a>.
          </p>
          <p style="margin-top: 30px;">À bientôt aux Gîtes du Soulor !</p>
        </div>
      `
    );

    return c.json({ success: true });
  } catch (error) {
    console.error("Error in send-booking-email endpoint:", error);
    return c.json({ error: "Internal server error", message: String(error) }, 500);
  }
});

Deno.serve(app.fetch);
