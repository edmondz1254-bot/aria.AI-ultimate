export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, history, userKey } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message' });
    }

    const apiKey = (userKey && typeof userKey === 'string' && userKey.startsWith('gsk_'))
      ? userKey
      : process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Server misconfigured: missing GROQ_API_KEY' });
    }

    const model = process.env.GROQ_MODEL || 'llama3-8b-8192';
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const safeHistory = Array.isArray(history) ? history.slice(-10) : [];

    const messages = [
      {
        role: 'system',
        content: 'You are aria.AI, a helpful and conversational AI assistant.'
      },
      ...safeHistory
        .filter(m => m && typeof m === 'object')
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: String(m.content || '')
        })),
      { role: 'user', content: message }
    ];

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
    });

    const text = await r.text();
    if (!r.ok) {
      return res.status(r.status).json({ error: 'Groq request failed', details: text });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'Invalid JSON from Groq', details: text });
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: 'Empty response from Groq', details: data });
    }

    return res.status(200).json({ content });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: String(e?.message || e) });
  }
}
