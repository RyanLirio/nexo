import 'dotenv/config';
import { OpenAIService } from './openai.service';
import { modelComparisonCases } from './model-comparison.cases';

const models = [
  {
    name: 'gpt-6-luna',
    inputPrice: 0.10,
    cachedInputPrice: 0.01,
    outputPrice: 0.50,
  },
  {
    name: 'gpt-5.4-mini',
    inputPrice: 0.75,
    cachedInputPrice: 0.075,
    outputPrice: 4.50,
  },
];

async function main() {
  const openAI = new OpenAIService();

  for (const model of models) {
    let totalInput = 0;
    let totalCachedInput = 0;
    let totalOutput = 0;
    let totalCost = 0;
    let totalTime = 0;

    console.log('\n\n========================================');
    console.log(`MODELO: ${model.name}`);
    console.log('========================================');

    for (let i = 0; i < modelComparisonCases.length; i++) {
      const message = modelComparisonCases[i];
      const start = Date.now();

      const result = await openAI.analyzeTechnicalMessage(
        message,
        model.name,
      );

      const duration = Date.now() - start;

      if (!result.usage) {
        throw new Error('A API não retornou dados de uso.');
      }

      const inputTokens = result.usage.input_tokens;
      const outputTokens = result.usage.output_tokens;

      const cachedTokens =
        result.usage.input_tokens_details?.cached_tokens ?? 0;

      const normalInputTokens = inputTokens - cachedTokens;

      const inputCost =
        (normalInputTokens / 1_000_000) * model.inputPrice;

      const cachedInputCost =
        (cachedTokens / 1_000_000) * model.cachedInputPrice;

      const outputCost =
        (outputTokens / 1_000_000) * model.outputPrice;

      const cost =
        inputCost +
        cachedInputCost +
        outputCost;

      totalInput += inputTokens;
      totalCachedInput += cachedTokens;
      totalOutput += outputTokens;
      totalCost += cost;
      totalTime += duration;

      console.log('\n----------------------------------------');
      console.log(`CASO ${i + 1}`);
      console.log('----------------------------------------');

      console.log(`Pergunta: ${message}`);
      console.log(`Classificação: ${result.classification}`);
      console.log(`Resposta: ${result.normalizedProblem}`);
      console.log(`Modelo real: ${result.responseModel}`);

      console.log('\nTOKENS');
      console.log(`Entrada: ${inputTokens}`);
      console.log(`Cache: ${cachedTokens}`);
      console.log(`Saída: ${outputTokens}`);
      console.log(`Total: ${result.usage.total_tokens}`);

      console.log('\nCUSTO');
      console.log(`Entrada: US$ ${inputCost.toFixed(8)}`);
      console.log(`Cache: US$ ${cachedInputCost.toFixed(8)}`);
      console.log(`Saída: US$ ${outputCost.toFixed(8)}`);
      console.log(`Caso: US$ ${cost.toFixed(8)}`);

      console.log(`Tempo: ${duration} ms`);
    }

    console.log('\n========================================');
    console.log(`RESUMO: ${model.name}`);
    console.log('========================================');

    console.log(`Casos: ${modelComparisonCases.length}`);
    console.log(`Tokens entrada: ${totalInput}`);
    console.log(`Tokens cache: ${totalCachedInput}`);
    console.log(`Tokens saída: ${totalOutput}`);
    console.log(`Custo total: US$ ${totalCost.toFixed(8)}`);
    console.log(
      `Custo médio/caso: US$ ${(totalCost / modelComparisonCases.length).toFixed(8)}`,
    );
    console.log(
      `Tempo médio: ${Math.round(totalTime / modelComparisonCases.length)} ms`,
    );
  }
}

main().catch(console.error);