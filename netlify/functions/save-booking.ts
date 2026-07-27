const SUPABASE_URL = "https://mdmwkojncfnqlxdxrxqo.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kbXdrb2puY2ZucWx4ZHhyeHFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5OTYwNzgsImV4cCI6MjA3NjU3MjA3OH0.1dWe6X-FYwp6x0TPRBswbVtMNTyV9tsurtQlkMoG23k";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const handler = async (event: {
  httpMethod: string;
  body: string | null;
}) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Empty body" }),
    };
  }

  let booking: {
    id: string;
    date: string;
    hour: number;
    clientName: string;
    clientEmail: string;
  };

  try {
    booking = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const { id, date, hour, clientName, clientEmail } = booking;
  if (!id || !date || hour === undefined || !clientName || !clientEmail) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Missing required fields" }),
    };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/kv_store_2b20b999`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ key: `booking:${id}`, value: booking }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: (err as Error).message }),
    };
  }
};
