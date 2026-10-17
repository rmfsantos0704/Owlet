const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function analyzeText(title: string, text: string) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You are a research assistant. Respond ONLY with JSON: {"summary": string (3-5 sentences), "paraphrase": string (the key arguments restated in your own words, one short paragraph), "tags": string[] (3-5 lowercase topic tags)}',
        },
        { role: "user", content: `Title: ${title}\n\n${text.slice(0, 12000)}` },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as any;
  const parsed = JSON.parse(data.choices[0].message.content);

  return {
    summary: String(parsed.summary ?? ""),
    paraphrase: String(parsed.paraphrase ?? ""),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 5) : [],
  };
}