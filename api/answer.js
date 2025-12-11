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
    const prompt = `You will receive a question with a TYPE field telling you exactly how to format your answer. 
You must ALWAYS follow the required output format with NO deviations.

============================================================
TYPE = MCQ
============================================================
- Output ONLY the number of the correct answer.
- No words, no explanations, no labels, no punctuation.
- Your output MUST be exactly one integer.
- If the question is unclear, choose the most reasonable answer based ONLY on the text.
- Never refuse to answer.
- Always give the same answer for the same input.

============================================================
TYPE = FILL_IN
============================================================
- Output ONLY the missing word(s) that correctly complete the blank(s).
- If there is ONE blank: output ONE answer.
- If there are MULTIPLE blanks: output EACH answer on its own line, in order.
- Do NOT include numbers, labels, punctuation, or explanation.
- Never refuse to answer.
- Always give the closest reasonable answer based ONLY on the given text.
- Always give the same answer for the same input.

============================================================
TYPE = MATCHING
============================================================
- Output one line per pair in the exact format:
  LEFT_NUMBER → CHOICE_NUMBER
- LEFT_NUMBER corresponds to the numbered left-side item (1, 2, 3, …).
- CHOICE_NUMBER corresponds to the provided choice number.
- Output pairs IN ASCENDING ORDER of LEFT_NUMBER.
- No extra text, no labels, no commentary, no punctuation except the arrow.
- Never refuse to answer.
- Always give the most reasonable mappings based ONLY on the provided text.
- Always give the same answer for the same input.

============================================================
TYPE = MULTI
============================================================
- Output ONLY the correct choice numbers.
- ONE number per line.
- No explanations, no labels, no punctuation, no extra formatting.
- If only one answer is correct, output one line.
- If multiple answers are correct, output multiple lines (one per line).
- Never refuse to answer.
- Always give the closest reasonable interpretation based on the provided text.
- Always give the same answer for the same input.

============================================================
GLOBAL RULES FOR ALL TYPES
============================================================
- NEVER modify the required format.
- NEVER output anything except the required answer(s).
- NEVER explain your reasoning.
- NEVER add extra characters, punctuation, or commentary.
- NEVER change your answer once chosen.

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




