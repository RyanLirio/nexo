import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod/v4';
import { zodTextFormat } from 'openai/helpers/zod';

const TechnicalMessageAnalysis = z.object({
  classification: z.enum([
    'TECHNICAL_PROBLEM',
    'DIFFICULTY',
    'NO_PROBLEM',
  ]),
  normalizedProblem: z.string().nullable(),
});

const ProjectContextExtraction = z.object({
  projects: z.array(
    z.object({
      projectId: z.string(),
      summary: z.string(),
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

TECHNICAL_PROBLEM:
Existe um problema técnico concreto ou uma causa técnica identificada.

DIFFICULTY:
A pessoa está travada ou com dificuldade, mas a causa técnica ainda não foi identificada.

NO_PROBLEM:
Não existe dificuldade nem problema técnico na mensagem.

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
    }>,
  ) {
    const projectList = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description ?? null,
      currentSummary: project.currentSummary ?? null,
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
      - O summary deve conter somente o contexto referente àquele projeto.
      - Não misture informações de projetos diferentes no mesmo summary.
      - Não invente informações ausentes na mensagem.
      - Se nenhum projeto puder ser identificado, retorne projects vazio.
      - Escreva todos os summaries exclusivamente em português do Brasil.
      - Cada projeto pode possuir currentSummary, que representa o contexto já consolidado desse projeto no dia atual.
      - Use currentSummary somente quando a mensagem atual também estiver relacionada àquele projeto.
      - Se houver currentSummary, produza um novo summary consolidando o contexto anterior com as novas informações da mensagem.
      - Preserve informações anteriores ainda relevantes.
      - Não repita informações desnecessariamente.
      - Não inclua um projeto apenas porque ele possui currentSummary; ele só deve aparecer se a mensagem atual falar sobre ele.
      - Se currentSummary for null, produza o summary somente com base na mensagem atual.
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

    return response.output_parsed;
  }
}