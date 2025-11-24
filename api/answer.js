export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Body may be string or object — support both
    let body = req.body;
    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const { text } = body || {};

    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    if (!process.env.GOOGLE_API_KEY) {
      return res.status(500).json({ error: "Missing GOOGLE_API_KEY env var" });
    }

    // ⭐ Add the minimal prompt BEFORE the extracted text
    const prompt = `Give only the final answer required—no explanations, no steps, no formatting, no extra text. For multiple choice, give only the correct choice text. For fill-in-the-blank or matching, give only the filled answer or matches. Output nothing except the final answer.
\n\n${text}`;

    // ⭐ Correct endpoint for v1beta Gemini 2.0 Flash Lite
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${encodeURIComponent(process.env.GOOGLE_API_KEY)}`;

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    };

    const raw = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(r => r.text());

    const data = JSON.parse(raw);

    const output =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "(no answer)";

    return res.status(200).json({ output });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

