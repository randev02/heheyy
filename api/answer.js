export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { text } = JSON.parse(req.body || "{}");
    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GOOGLE_API_KEY" });
    }

    const result = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text }]
            }
          ]
        })
      }
    );

    const data = await result.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const output =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response generated";

    return res.status(200).json({ output });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
