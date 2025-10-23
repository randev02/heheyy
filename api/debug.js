export default function handler(req, res) {
  // Check if the env var exists (without exposing it)
  const key = process.env.GOOGLE_API_KEY || "";
  
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    hasKey: !!key,
    keyLength: key.length
  });
}
