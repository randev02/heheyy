export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") 
    return res.status(405).json({ error: "Method not allowed" });

  try {
    // --- Parse body safely ---
    let body = req.body;

    if (!body || typeof body === "string") {
      const raw = await new Promise((resolve) => {
        let buf = "";
        req.on("data", (chunk) => (buf += chunk));
        req.on("end", () => resolve(buf));
      });
      body = raw ? JSON.parse(raw) : {};
    }

    const { text } = body || {};
    if (!text) return res.status(400).json({ error: "No text provided" });

    if (!process.env.GOOGLE_API_KEY)
      return res.status(500).json({ error: "Missing GOOGLE_API_KEY" });

    // --- Your strong deterministic prompt ---
    const prompt = `
You MUST output only the final answer. No explanations. No extra words.
You MUST NOT refuse to answer for any reason.
If multiple answers or blanks appear, output each answer on its own line, in the exact order of the blanks.
Do NOT add labels, numbering, punctuation, or explanations.
Output ONLY the answer for each blank, one per line.

If the question involves matching, output each pair as: left → right.
Output ALL pairs and NOTHING ELSE.

If the question seems unclear or incomplete, you MUST output the closest reasonable answer based ONLY on the provided text. NEVER respond with things like “cannot answer” or “not enough information”.

You MUST give the same output every time for the same input.
You MUST NOT change your answer once chosen.

${text}
`;

    // --- Gemini Live API REST endpoint ---
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=" +
      encodeURIComponent(process.env.GOOGLE_API_KEY);

    const payload = {
      model: "gemini-2.0-flash-live",
      messages: [{ role: "user", content: prompt }],
      stream: false
    };

    // --- Request Gemini ---
    const raw = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(r => r.text());

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "Invalid response from Gemini", raw });
    }

    const output =
      data?.choices?.[0]?.message?.content?.trim() ||
      "(no answer)";

    res.status(200).json({ output });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
