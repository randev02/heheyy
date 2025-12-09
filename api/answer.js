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
    // ⭐ Vercel body parsing fix (req.body is often empty)
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

    // ⭐ FINAL strict deterministic prompt
    const prompt = `You MUST output only the final answer. No explanations. No extra words.
You MUST NOT refuse to answer.
If the question is unclear or impossible, you MUST output the closest valid answer based ONLY on the choices provided.
If matching items, output each pair in the exact format: left → right.
Output ALL pairs and NOTHING ELSE.
Do NOT rephrase, explain, add notes, comments, apologies, or punctuation.
Your entire output MUST be exactly the answer, word for word, and nothing else.
You MUST give the same output every time for the same input.
You MUST NOT change your answer once chosen.

${text}`;

    // ⭐ Updated model to Gemini 2.5 Flash Lite
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" +
      encodeURIComponent(process.env.GOOGLE_API_KEY);

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0, // deterministic
        topK: 1,
        topP: 1
      }
    };

    // ⭐ Read raw response (Gemini sometimes returns non-JSON errors)
    const raw = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.text());

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
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
