export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ⭐ Vercel body parsing fix
    let body = req.body;

    if (!body || typeof body === "string") {
      try {
        const raw =
          typeof req.body === "string"
            ? req.body
            : await new Promise((resolve, reject) => {
                let buf = "";
                req.on("data", (chunk) => (buf += chunk));
                req.on("end", () => resolve(buf));
                req.on("error", reject);
              });

        body = raw ? JSON.parse(raw) : {};
      } catch {
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

    const prompt = `Give only the final answer. No explanations.
If the question requires matching items, output each pair “left → right”.
Do not output only left or only right.
Output all pairs.
Do not add anything else.\n\n${text}`;

    // ⭐ Updated to Gemini 2.5 Flash Lite
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" +
      encodeURIComponent(process.env.GOOGLE_API_KEY);

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    };

    // Read raw text from Gemini (it sometimes returns strings instead of JSON)
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
