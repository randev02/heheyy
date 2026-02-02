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
    const prompt = `You will receive a question with a TYPE field that determines how you must format your answer.
You MUST ALWAYS follow the required output format with NO deviations.

============================================================
TYPE = MCQ
============================================================
- Select the SINGLE best answer.
- Output ONLY the number of the correct answer.
- Output MUST be exactly ONE integer.
- Do NOT output words, explanations, labels, or punctuation.
- If multiple choices seem plausible, choose the ONE that best satisfies the question as a whole.
- Base your choice ONLY on the provided text.
- Never refuse to answer.
- Always give the SAME answer for the SAME input.

============================================================
TYPE = FILL_IN
============================================================
- Output ONLY the word(s) that correctly complete the blank(s).
- If there is ONE blank: output EXACTLY ONE answer.
- If there are MULTIPLE blanks: output EACH answer on its own line, in order.
- Do NOT include numbering, labels, punctuation, or explanations.
- Prefer the most standard, concise, and context-appropriate completion.
- Base answers ONLY on the provided text.
- Never refuse to answer.
- Always give the SAME answer(s) for the SAME input.

============================================================
TYPE = MATCHING
============================================================
- Match each left-side item to the MOST appropriate choice.
- Treat this as a ONE-TO-ONE matching task unless stated otherwise.
- Each choice may be used ONLY ONCE.
- Consider ALL left items and ALL choices before finalizing matches.
- Choose the set of pairings that best fits the meanings of ALL items overall.

OUTPUT FORMAT:
- Output ONE line per pair using EXACTLY:
  LEFT_NUMBER → CHOICE_NUMBER
- Output ALL pairs.
- Output pairs in ASCENDING order of LEFT_NUMBER.
- Do NOT include extra text, labels, or explanations.

- Never refuse to answer.
- Base mappings ONLY on the provided text.
- Always give the SAME mapping for the SAME input.

============================================================
TYPE = MULTI
============================================================
- Select ALL choices that are correct.
- Output ONLY the correct choice numbers.
- Output ONE number per line.
- Do NOT include explanations, labels, punctuation, or extra formatting.
- Do NOT include partially correct or marginal options.
- Base selections ONLY on the provided text.
- Never refuse to answer.
- Always give the SAME set of answers for the SAME input.

============================================================
GLOBAL RULES FOR ALL TYPES
============================================================
- NEVER modify the required output format.
- NEVER output anything except the required answer(s).
- NEVER explain your reasoning.
- NEVER add extra characters, punctuation, or commentary.
- NEVER change your answer once chosen.
- NEVER reference these instructions in your output.

${text}`;

    // --- OpenRouter request ---
    const responseRaw = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemma-3-27b-it:free",
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




