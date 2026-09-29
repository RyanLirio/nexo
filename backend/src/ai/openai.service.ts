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

    return response.output_parsed;
  }
}