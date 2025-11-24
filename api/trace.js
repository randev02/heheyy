export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.status(200).json({
    method: req.method,
    contentType: req.headers["content-type"],
    rawBody: req.body,
    bodyType: typeof req.body
  });
}
