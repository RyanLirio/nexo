import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod/v4';
import { zodTextFormat } from 'openai/helpers/zod';

const TechnicalClassification = z.enum([
  'TECHNICAL_PROBLEM',
  'DIFFICULTY',
  'NO_PROBLEM',
]);

const technicalClassificationInstructions = `
NO_PROBLEM:
Não existe dificuldade ou problema técnico relatado.

DIFFICULTY:
O usuário relata dificuldade, bloqueio ou impedimento, mas o problema técnico concreto ainda não está identificado.
Não invente causa técnica.

TECHNICAL_PROBLEM:
Existe sintoma técnico concreto, comportamento técnico identificável ou causa técnica conhecida.
`;

const TechnicalMessageAnalysis = z.object({
  classification: TechnicalClassification,
  normalizedProblem: z.string().nullable(),
});

const ProjectContextExtraction = z.object({
  projects: z.array(
    z.object({
      projectId: z.string(),
      summary: z.string(),
      difficulties: z.string().nullable(),
      nextSteps: z.string().nullable(),
      classification: TechnicalClassification,
      normalizedProblem: z.string().nullable(),
    }),
  ),
});

@Injectable()
export class OpenAIService {
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  }

  async analyzeTechnicalMessage(text: string, model: string) {
    const response = await this.client.responses.parse({
      model,
      instructions: `
Classifique a mensagem de trabalho em uma destas categorias:

${technicalClassificationInstructions}

Quando for TECHNICAL_PROBLEM, normalizedProblem deve ser uma frase técnica natural contendo:
- sintoma ou problema;
- causa, somente se conhecida;
- tecnologia envolvida;
- contexto relevante.

Não invente causas ou informações ausentes.

Para DIFFICULTY ou NO_PROBLEM, normalizedProblem deve ser null.
      `,
      input: text,
      text: {
        format: zodTextFormat(
          TechnicalMessageAnalysis,
          'technical_message_analysis',
        ),
      },
    });

    if (!response.output_parsed) {
      throw new Error('A IA não retornou uma análise estruturada.');
    }

    return {
      ...response.output_parsed,
      responseModel: response.model,
      usage: response.usage,
    };
  }

  async extractProjectContexts(
    message: string,
    projects: Array<{
      id: string;
      name: string;
      description?: string | null;
      currentSummary?: string | null;
      currentDifficulties?: string | null;
      currentNextSteps?: string | null;
    }>,
  ) {
    const projectList = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description ?? null,
      currentSummary: project.currentSummary ?? null,
      currentDifficulties: project.currentDifficulties ?? null,
      currentNextSteps: project.currentNextSteps ?? null,
    }));

    const response = await this.client.responses.parse({
      model: 'gpt-5.4-mini',
      instructions: `
      Você recebe uma mensagem de trabalho de um usuário e a lista de projetos ativos dos quais ele participa.

      Seu objetivo é separar somente as informações da mensagem que pertencem a cada projeto.

      Regras:
      - Use somente projectId existentes na lista fornecida.
      - Não invente projetos.
      - Não associe a mensagem a um projeto apenas por suposição fraca.
      - Se um projeto não foi mencionado ou não há contexto suficiente para associá-lo, não o inclua.
      - Uma mensagem pode pertencer a mais de um projeto.
      - summary representa o avanço ou contexto principal do trabalho naquele projeto.
      - difficulties representa somente uma dificuldade relatada pelo usuário naquele projeto. Use null quando a mensagem não trouxer dificuldade.
      - nextSteps representa somente um próximo passo explicitamente informado ou claramente declarado pelo usuário. Use null quando a mensagem não trouxer próximo passo.
      - Não invente dificuldades nem próximos passos.
      - classification deve classificar individualmente o contexto da mensagem atual referente àquele projeto usando exatamente estas definições:
      ${technicalClassificationInstructions}
      - Para classification, considere somente as informações da mensagem atual que pertencem ao projeto avaliado.
      - Não use informações de outro projeto nem o contexto anterior para determinar classification.
      - Quando classification for TECHNICAL_PROBLEM, normalizedProblem deve preservar fielmente o significado técnico da mensagem em uma frase natural.
      - Escreva normalizedProblem como uma descrição técnica útil para recuperação semântica, não como um resumo genérico do relato.
      - Preserve, quando presentes, o sintoma técnico, a tecnologia, o componente ou sistema afetado, a causa conhecida e o contexto necessário para distinguir o problema.
      - Mantenha termos técnicos importantes citados pelo usuário; não os substitua por descrições genéricas nem os omita.
      - Prefira uma estrutura direta que conecte componente técnico, sintoma e momento ou sistema afetado. Ao reformular uma relação causal, preserve os dois lados da relação e seus qualificadores técnicos.
      - Quando a mensagem informar uma causa técnica concreta para um efeito mais genérico, use a causa técnica como núcleo de normalizedProblem e preserve o efeito como consequência quando ele for relevante.
      - normalizedProblem deve ser autocontido: resolva referências abreviadas pelo papel técnico que a própria mensagem estabelecer de forma inequívoca.
      - Converta linguagem conversacional em terminologia técnica estável quando o significado for equivalente, sem acrescentar protocolo, fornecedor, componente ou causa que não estejam sustentados pela mensagem.
      - Se o significado de uma referência abreviada continuar ambíguo, mantenha a referência original sem adivinhar.
      - projectId já representa a associação ao projeto. Não inclua o nome do projeto em normalizedProblem; descreva diretamente o evento técnico, o componente e o sistema afetado informados na mensagem.
      - Não transforme um problema específico em um resumo genérico e não use contexto de negócio como substituto do contexto técnico.
      - Nunca invente causa ou detalhes em normalizedProblem e não adicione solução.
      - Quando classification for DIFFICULTY ou NO_PROBLEM, normalizedProblem deve ser null.
      - Cada campo deve conter somente o contexto referente àquele projeto.
      - Não misture informações de projetos diferentes no mesmo summary.
      - Não invente informações ausentes na mensagem.
      - Se nenhum projeto puder ser identificado, retorne projects vazio.
      - Escreva summary, difficulties e nextSteps exclusivamente em português do Brasil.
      - Cada projeto pode possuir currentSummary, currentDifficulties e currentNextSteps, que representam o contexto já registrado no dia atual.
      - Use o contexto anterior somente quando a mensagem atual também estiver relacionada àquele projeto.
      - Se houver currentSummary, produza um novo summary consolidando o contexto anterior com as novas informações da mensagem, como já ocorre no fluxo atual.
      - Preserve informações anteriores ainda relevantes.
      - Não repita informações desnecessariamente.
      - Não inclua um projeto apenas porque ele possui contexto anterior; ele só deve aparecer se a mensagem atual falar sobre ele.
      - Se currentSummary for null, produza o summary somente com base na mensagem atual.
      - Se a mensagem atual não mencionar nova dificuldade ou novo próximo passo, retorne null no respectivo campo. O sistema preservará o valor anterior já registrado.
          `,
      input: JSON.stringify({
        message,
        activeProjects: projectList,
      }),
      text: {
        format: zodTextFormat(
          ProjectContextExtraction,
          'project_context_extraction',
        ),
      },
    });

    if (!response.output_parsed) {
      throw new Error('A IA não conseguiu separar o contexto por projeto.');
    }

    for (const project of response.output_parsed.projects) {
      if (
        project.classification === 'TECHNICAL_PROBLEM'
        && !project.normalizedProblem?.trim()
      ) {
        throw new Error(
          'A IA não normalizou o problema técnico identificado.',
        );
      }
    }

    return {
      projects: response.output_parsed.projects.map((project) => ({
        ...project,
        normalizedProblem:
          project.classification === 'TECHNICAL_PROBLEM'
            ? project.normalizedProblem!.trim()
            : null,
      })),
    };
  }
}
