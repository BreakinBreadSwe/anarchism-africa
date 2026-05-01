/* A.A.AI — model-agnostic chat client.
 * Default: Gemini. Reads window.AA_CONFIG.ai for provider/model.
 * If a /api/ai/chat endpoint exists, uses it. Otherwise, falls back to a
 * local "library oracle" so the demo always responds, even offline.
 *
 * To swap models later (Qwen, DeepSeek, Kimi, GLM, Yi, MoonshotAI, etc.):
 *   - implement matching routes in /api/ai/<provider>.js (server-side)
 *   - update AA_CONFIG.ai.provider / .model from the Studio page.
 */
(function () {
  const localKnowledge = [
    { match: /\b(merch|tee|hoodie|tote|shirt)/i,
      reply: "Our giftshop is print-on-demand only. We use Stanley/Stella (GOTS, Fair Wear) and Teemill (B-Corp, Climate-Neutral). Every piece is carbon-tracked, no warehouse stock — your order is printed when you place it." },
    { match: /\b(ambassador|host|local)/i,
      reply: "Ambassadors are local stewards — host listening sessions, run reading circles, translate, organise. Apply on the Ambassadors tab and a publisher will review within ~5 days." },
    { match: /\b(film|movie|video|watch)/i,
      reply: "Films sit in the Films tab. Tap a poster — the player streams the embed. We host short docs, fiction and field recordings from across Africa & diaspora." },
    { match: /\b(library|read|article|essay|book)/i,
      reply: "The Library has essays, interviews and a free open-library reader. Walter Rodney's 'How Europe Underdeveloped Africa' is annotated by readers in 14 cities — start there." },
    { match: /\b(donate|fund|crowdfund|pledge)/i,
      reply: "Crowdfund tab. We pool resources for zines, soundsystems and expos. Pledges go to escrow — no cut for us. Each campaign reports back where money lands." },
    { match: /\b(anarchism|anarchy|anarch)/i,
      reply: "On this platform anarchism is a verb, not a flag — practices of mutual aid, horizontal decision-making, and refusing the state-as-employer logic. Africa has been doing this for centuries; we just stopped giving the credits to ourselves." },
    { match: /\b(luvlab|coolhuntparis|who runs)/i,
      reply: "LUVLAB is the steward (admin). COOLHUNTPARIS curates publishing — like a magazine + library + expo + giftshop. Merch is run by staff. Partners co-create projects. Consumers can become ambassadors." },
    { match: /\b(ai|gemini|qwen|deepseek|model|chinese)/i,
      reply: "I'm A.A.AI — the platform's library oracle. By default I'm wired to Gemini, but the stack is model-agnostic: Qwen, DeepSeek, Kimi, GLM, Yi and MoonshotAI all plug in via the AI provider config in Studio." }
  ];

  function localAnswer (q) {
    for (const k of localKnowledge) if (k.match.test(q)) return k.reply;
    return "Sorry, I don't have that in the offline archive. Once Gemini is wired, I'll search films, articles, music, books and events for you. — Try asking about merch, ambassadors, the library, or how anarchism is practised here.";
  }

  async function callServer (provider, model, messages) {
    const ep = (window.AA_CONFIG?.ai?.endpoint) || '/api/ai/chat';
    const r = await fetch(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, messages })
    });
    if (!r.ok) throw new Error(`AI server ${r.status}`);
    const data = await r.json();
    return data.text || data.message || data.choices?.[0]?.message?.content || '';
  }

  async function ask (userText, history = []) {
    const cfg = (window.AA && AA.cfg ? AA.cfg() : window.AA_CONFIG)?.ai || { provider: 'gemini', model: 'gemini-1.5-flash' };
    const messages = [
      { role: 'system', content: 'You are A.A.AI, the library oracle of ANARCHISM.AFRICA — afrofuturist, kind, terse, well-read. Cite films, books, articles or events from the archive when relevant.' },
      ...history.slice(-10),
      { role: 'user', content: userText }
    ];
    try {
      const text = await callServer(cfg.provider, cfg.model, messages);
      if (text && text.trim()) return text;
      throw new Error('empty');
    } catch (e) {
      // Offline / no server / failed call — graceful local fallback.
      return localAnswer(userText);
    }
  }

  window.AA_AI = { ask };
})();
