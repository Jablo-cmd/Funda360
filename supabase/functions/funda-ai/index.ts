type RequestBody = { question?: string; context?: Record<string, unknown> };

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: {'content-type':'application/json'} });
  const auth = req.headers.get('authorization');
  if (!auth?.toLowerCase().startsWith('bearer ')) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: {'content-type':'application/json'} });

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const question = body.question?.trim();
  if (!question) return new Response(JSON.stringify({ error: 'question is required' }), { status: 400, headers: {'content-type':'application/json'} });

  const providerUrl = Deno.env.get('AI_PROVIDER_URL');
  const apiKey = Deno.env.get('AI_API_KEY');
  const model = Deno.env.get('AI_MODEL') ?? 'school-copilot';

  if (!providerUrl || !apiKey) {
    return new Response(JSON.stringify({
      answer: 'Funda Copilot is operating in secure rules mode. Configure AI_PROVIDER_URL, AI_API_KEY and optionally AI_MODEL to enable provider-backed generation.',
      model: 'rules',
      context: body.context ?? {},
    }), { headers: {'content-type':'application/json'} });
  }

  const response = await fetch(providerUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are Funda360 Copilot. Use only the supplied school context. Do not invent learner facts. Protect personal information and explain uncertainty.' },
        { role: 'user', content: JSON.stringify({ question, context: body.context ?? {} }) },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return new Response(JSON.stringify({ error: 'AI provider request failed', provider_status: response.status }), { status: 502, headers: {'content-type':'application/json'} });

  const answer = payload?.choices?.[0]?.message?.content ?? payload?.output_text ?? payload?.answer;
  if (typeof answer !== 'string') return new Response(JSON.stringify({ error: 'AI provider returned an unsupported response shape' }), { status: 502, headers: {'content-type':'application/json'} });
  return new Response(JSON.stringify({ answer, model, provider_backed: true }), { headers: {'content-type':'application/json'} });
});
