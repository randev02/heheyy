export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ⭐ VERCEL BODY FIX — support both parsed and raw bodies
    let body = req.body;

    // If body is missing, manually read raw buffer (Vercel 2024 behavior)
    if (!body || typeof body === "string") {
      try {
        const raw = typeof req.body === "string"
          ? req.body
          : await new Promise((resolve, reject) => {
              let buf = "";
              req.on("data", (chunk) => (buf += chunk));
              req.on("end", () => resolve(buf));
              req.on("error", reject);
            });

        body = raw ? JSON.parse(raw) : {};
      } catch (e) {
        return res.status(400).json({ error: "Invalid JSON body" });
      }
    }

    const { text } = body || {};

    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    if (!process.env.GOOGLE_API_KEY) {
      return res.status(500).json({ error: "Missing GOOGLE_API_KEY env var" });
    }

    // ⭐ Minimal directive + extracted question
    const prompt = `Give only the final answer. No explanations.
If the question requires matching items, output each pair together “left → right”.
Do not output only the left or right items. Output all pairs.
Do not add anything else.
\n\n${text}`;

    // Gemini 2.0 Flash Lite endpoint
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=" +
      encodeURIComponent(process.env.GOOGLE_API_KEY);

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    };

    // ⭐ Always read raw text first (Gemini sometimes returns non-JSON error blobs)
    const raw = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.text());

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return res.status(500).json({
        error: "Gemini returned non-JSON response",
        raw
      });
    }

    const output =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "(no answer)";

    return res.status(200).json({ output });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
