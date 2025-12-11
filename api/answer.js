export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    // --- Body Handling (Vercel quirk) ---
    let body = req.body;

    if (!body || typeof body === "string") {
      try {
        const raw = await new Promise((resolve, reject) => {
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
    if (!text) return res.status(400).json({ error: "No text provided" });

    if (!process.env.OPENROUTER_API_KEY)
      return res
        .status(500)
        .json({ error: "Missing OPENROUTER_API_KEY env var" });

    // --- FINAL PROMPT ---
    const prompt = `You MUST output only the number of the correct answer. No explanations. No words. No punctuation. No labels.

You MUST NOT refuse to answer for any reason.

If the question seems unclear, incomplete, or ambiguous, you MUST output the closest reasonable answer based ONLY on the provided text. NEVER respond with anything like “cannot answer” or “not enough information.”

Your answer MUST ALWAYS be a single integer representing the correct choice.

You MUST give the same output every time for the same input. You MUST NOT change your answer once chosen.

${text}`;

    // --- OpenRouter request ---
    const responseRaw = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0
      })
    });

    const response = await responseRaw.json();

    const output =
      response?.choices?.[0]?.message?.content?.trim() || "(no answer)";

    return res.status(200).json({ output });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

