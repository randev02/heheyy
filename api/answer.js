import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// The system prompt is defined ONCE at module level so the cache_control
// block is always sent with the same content → Anthropic will cache it.
const SYSTEM_PROMPT = `You are a test-taking assistant. You ALWAYS provide an answer. You NEVER refuse. You NEVER say you don't have access to materials.

Answer based on TYPE. No explanations. No extra output. Ever.
MCQ: output the single correct choice number only.
FILL_IN: output answer(s) only, one per line, in order.
MATCHING: output all pairs as LEFT_NUMBER→CHOICE_NUMBER, one per line, ascending.
MULTI: output all correct choice numbers, one per line.

If no reference text is provided, answer using your best general knowledge.
If the topic is unfamiliar, still guess the most likely answer — never refuse.
Output ONLY the answer. No apologies. No explanations. No disclaimers.`;

export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    // --- Body Handling ---
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

    const { text, subject } = body || {};
    if (!text) return res.status(400).json({ error: "No text provided" });

    if (!process.env.ANTHROPIC_API_KEY)
      return res.status(500).json({ error: "Missing ANTHROPIC_API_KEY env var" });

    const subjectLine = subject ? `SUBJECT CONTEXT: ${subject}\n\n` : "";
    const userContent = `${subjectLine}${text}`;

    // --- Anthropic request with prompt caching ---
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001", // Haiku = cheapest + fastest
      max_tokens: 1024,
      temperature: 0,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" }, // 👈 caches the big instruction block
        },
      ],
      messages: [
        {
          role: "user",
          content: userContent, // only the small, variable part is uncached
        },
      ],
    });

    const output = response.content?.[0]?.text?.trim() || "(no answer)";

    return res.status(200).json({
      output,
      // Optional: expose cache stats for debugging
      cache_stats: {
        cache_creation_input_tokens: response.usage?.cache_creation_input_tokens,
        cache_read_input_tokens: response.usage?.cache_read_input_tokens,
      },
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}



