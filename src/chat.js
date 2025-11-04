import { v4 as uuid } from "uuid";

const TOKEN = process.env.TOKEN ?? "***";
const BASE_URL = process.env.BASE_URL ?? "https://text.pollinations.ai/openai";
const DEBUG = process.env.DEBUG ?? false;

export async function chatCompletion(req, res) {
  const {
    messages,
    model,
    tools = [],
    tool_choice = "auto",
    stream = false,
  } = req.body;

  if (!TOKEN) {
    return res
      .status(500)
      .json({ error: "TOKEN -> POLLINATIONS_REFRESH_TOKEN not set" });
  }

  const chatId = uuid();

  const payload = {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    model,
    stream,
    tools,
    tool_choice,
  };

  if (DEBUG) {
    console.log("Payload:", payload);
  }

  const resp = await fetch(`${BASE_URL}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    return res.status(resp.status).json({ error: await resp.text() });
  }

  /* ---------- СТРИМ ---------- */
  if (stream) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    const decoder = new TextDecoder();
    const reader = resp.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value));
    }
    res.end();
    return;
  }

  /* ---------- ОБЫЧНЫЙ ОТВЕТ ---------- */
  const data = await resp.json();
  if (DEBUG) {
    console.log("Response:", data);
  }
  const content = data.text || data.choices?.[0]?.message?.content || "";

  res.json({
    id: chatId,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  });
}
