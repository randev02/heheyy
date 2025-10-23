export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { question = "", instruction = "", choices = [] } = req.body || {};

    // Check for missing key or data
    if (!process.env.GOOGLE_API_KEY) {
      return res.status(500).json({ error: "Missing GOOGLE_API_KEY env var" });
    }
    if (!question || !Array.isArray(choices) || choices.length === 0) {
      return res.status(400).json({ error: "Missing question or choices" });
    }

    // Build prompt
    const prompt = `
You are a concise quiz-answering assistant. Read the instruction, question and choices, and return ONLY the best single answer (no explanations, no numbering).

Instruction:
${instruction}

Question:
${question}

Choices:
${choices.map((c,i)=>`${i+1}. ${c}`).join('\n')}

Respond with only the correct choice text (no number, no extra words).
    `.trim();

    // --- Gemini 2.0 Flash-Lite endpoint ---
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${encodeURIComponent(process.env.GOOGLE_API_KEY)}`;

    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 64 }
    };

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const raw = await resp.text();
    if (!resp.ok) {
      return res.status(500).json({ error: "GeminiError", status: resp.status, body: raw });
    }

    const data = JSON.parse(raw);
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "(no answer)";

    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
