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
    const prompt = `You will receive a question with a TYPE field that tells you what format the answer must be in.

If TYPE = MCQ:
- You MUST output only the number of the correct answer.
- No explanations, no words, no punctuation, no labels.
- You MUST NOT refuse to answer for any reason.
- If the question is unclear or ambiguous, output the closest reasonable answer based ONLY on the provided text.
- Your answer MUST ALWAYS be a single integer.
- You MUST give the same output every time for the same input.

If TYPE = FILL_IN:
- You MUST output only the missing word(s) needed to fill the blank(s).
- One blank = output EXACTLY one answer.
- Multiple blanks = output each answer on its own line, in order.
- No numbers, no labels, no punctuation, no explanations.
- You MUST NOT refuse to answer for any reason.
- If the question is unclear or ambiguous, output the closest reasonable answer based ONLY on the provided text.
- You MUST give the same output every time for the same input.

If TYPE = MATCHING:
- You MUST output one line per pair in the format:
  LEFT_NUMBER → CHOICE_NUMBER
- LEFT_NUMBER is the number of the left item (1, 2, 3, ...).
- CHOICE_NUMBER is the number assigned to the matching choice.
- No extra text, no labels, no punctuation except the arrow.
- Output the pairs in ascending order of LEFT_NUMBER.
- You MUST NOT refuse to answer for any reason.
- If the question is unclear or ambiguous, output the closest reasonable mapping based ONLY on the provided text.
- You MUST give the same output every time for the same input.

Never change your answer once chosen. Never output anything other than the required answer format.

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



