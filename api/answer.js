export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { question = "", instruction = "", choices = [] } = req.body || {};

    const messages = [
      {
        role: "system",
        content:
          "You are a concise quiz-answering assistant. Read the instruction, question, and choices, then return ONLY the best single answer (no explanations)."
      },
      {
        role: "user",
        content:
`Instruction:
${instruction}

Question:
${question}

Choices:
${choices.map((c,i)=>`${i+1}. ${c}`).join('\n')}

Answer with only the correct choice text (no number, no explanation).`
      }
    ];

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPEN_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.2,
        max_tokens: 50
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(500).json({ error: txt });
    }

    const data = await resp.json();
    const answer = data?.choices?.[0]?.message?.content?.trim() || "(no answer)";
    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
