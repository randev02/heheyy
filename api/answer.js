export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = req.body || {};
    const text = (body.text || "").trim();

    if (!text) {
      return res.status(400).json({ error: "Missing text field" });
    }

    if (!process.env.GOOGLE_API_KEY) {
      return res.status(500).json({ error: "Missing GOOGLE_API_KEY env var" });
    }

    // --- PROMPT ---
    const prompt = `
You are a precise quiz-answering AI.
You will be given a raw block of text containing a question and multiple answer choices.
Your job:
1. Detect the question.
2. Detect the answer choices.
3. Return ONLY the correct answer — no explanation, no numbering, no extra words.
4. If choices include letters (A, B, C...), return the choice text, not the letter.

Text:
${text}
    `.trim();

    // --- GEMINI CALL ---
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=" +
      encodeURIComponent(process.env.GOOGLE_API_KEY);

    const reqBody = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 64 }
    };

    const gResp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqBody)
    });

    const raw = await gResp.text();
    if (!gResp.ok) {
      return res.status(500).json({
        error: "GeminiError",
        status: gResp.status,
        body: raw
      });
    }

    const data = JSON.parse(raw);
    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "(no answer)";

    return res.status(200).json({ answer });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
