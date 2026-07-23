const fallbackAnswers = [
  "Eu separaria isso em tres blocos: contas essenciais, conforto e aporte. Pelo seu mes atual, a faixa saudavel de investimento esta entre R$ 1.000 e R$ 1.420.",
  "Seu maior desvio esta em alimentacao fora. Se voce voltar para sua media dos ultimos tres meses, libera cerca de R$ 380 para a reserva.",
  "Para uma carteira conservadora, eu aumentaria renda fixa ate fechar seis meses de custo de vida antes de elevar risco em acoes.",
  "Sua meta principal esta no caminho certo. Mantendo R$ 1.200 por mes, a reserva chega em R$ 30.000 em aproximadamente dez meses."
];

export async function askClara(prompt, messages) {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  if (!apiKey) {
    return fallbackAnswers[Math.floor(Math.random() * fallbackAnswers.length)];
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.EXPO_PUBLIC_OPENAI_MODEL || "gpt-5",
        instructions:
          "Voce e Clara, uma assistente financeira brasileira. Ajude com orcamento, habitos de gasto, metas e organizacao de investimentos. Seja clara, breve e cuidadosa. Nao prometa rentabilidade nem de recomendacoes individualizadas como consultoria financeira regulada.",
        input: [
          ...messages.slice(-8).map((message) => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.text
          })),
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error("OpenAI request failed");
    }

    const data = await response.json();
    return data.output_text || "Nao consegui responder agora, mas posso tentar de novo.";
  } catch (error) {
    return "A IA real nao respondeu agora. Enquanto isso, minha leitura local: mantenha caixa do mes protegido antes de aumentar aportes.";
  }
}
