import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { getDb, getPackages, listTeams } from './db';
import { optimizeForTeams } from './optimizer';
import type { OptimizationResult } from '$lib/types';
import type { OptimizeInput } from './optimizer';

interface KnowledgeChunk {
  id: string;
  content: string;
}

interface EmbeddedChunk extends KnowledgeChunk {
  embedding: number[];
}

export interface ChatResponse {
  answer: string;
  source: 'openai' | 'local';
  action?: { type: 'selectTeams'; teams: string[] };
}

const embeddingModel = 'text-embedding-3-small';

function euro(cents: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function knowledgeChunks(): KnowledgeChunk[] {
  const packageChunks = getPackages().map((item) => {
    const prices = item.prices
      .map((price) =>
        price.billingPeriod === 'annual'
          ? `${euro(price.monthlyPriceCents)} pro Monat bei 12 Monaten Bindung`
          : `${euro(price.monthlyPriceCents)} monatlich kündbar`
      )
      .join(' oder ');
    return { id: `package-${item.id}`, content: `Streaming-Paket ${item.name}: ${prices}.` };
  });

  const teams = listTeams('', 2_000);
  const teamChunks: KnowledgeChunk[] = [];
  for (let index = 0; index < teams.length; index += 30) {
    const names = teams.slice(index, index + 30);
    teamChunks.push({
      id: `teams-${index / 30}`,
      content: `In der Anwendung auswählbare Mannschaften: ${names.join(', ')}.`
    });
  }
  return [
    ...packageChunks,
    ...teamChunks,
    {
      id: 'faq-prices',
      content:
        'Preise werden in Euro angezeigt. Der Jahrespreis ist der monatliche Tarifpreis bei zwölf Monaten Bindung, multipliziert mit zwölf.'
    },
    {
      id: 'faq-coverage',
      content:
        'Die Optimierung kann getrennt für Live-Übertragungen oder Highlights erfolgen. Spiele ohne passendes Angebot werden transparent ausgewiesen.'
    },
    {
      id: 'faq-method',
      content:
        'Die günstigste Kombination wird als binäres Set-Cover-Problem exakt gelöst. Bei sehr großen Problemen dient ein Greedy-Verfahren als schneller Fallback.'
    }
  ];
}

function chunkKey(chunk: KnowledgeChunk) {
  return createHash('sha256').update(`${embeddingModel}:${chunk.id}:${chunk.content}`).digest('hex');
}

async function loadEmbeddings(openai: OpenAI): Promise<EmbeddedChunk[]> {
  const chunks = knowledgeChunks();
  const db = getDb();
  const select = db.prepare('SELECT embedding_json FROM knowledge_embeddings WHERE id = ? AND model = ?');
  const insert = db.prepare(`
    INSERT OR REPLACE INTO knowledge_embeddings (id, content, model, embedding_json, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const embedded: EmbeddedChunk[] = [];
  const missing: Array<KnowledgeChunk & { key: string }> = [];

  for (const chunk of chunks) {
    const key = chunkKey(chunk);
    const row = select.get(key, embeddingModel) as { embedding_json: string } | undefined;
    if (row) embedded.push({ ...chunk, embedding: JSON.parse(row.embedding_json) as number[] });
    else missing.push({ ...chunk, key });
  }

  for (let index = 0; index < missing.length; index += 100) {
    const batch = missing.slice(index, index + 100);
    const response = await openai.embeddings.create({ model: embeddingModel, input: batch.map((chunk) => chunk.content) });
    const saveBatch = db.transaction(() => {
      response.data.forEach((item, itemIndex) => {
        const chunk = batch[itemIndex];
        insert.run(chunk.key, chunk.content, embeddingModel, JSON.stringify(item.embedding));
        embedded.push({ id: chunk.id, content: chunk.content, embedding: item.embedding });
      });
    });
    saveBatch();
  }
  return embedded;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] ** 2;
    normB += b[index] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function resultContext(result: OptimizationResult) {
  const option = result[result.recommended];
  const packages = option.packages
    .map((item) => `${item.name} (${euro(item.costCents)}, ${item.coveredGameIds.length} Spiele)`)
    .join(', ');
  return [
    `Ausgewählte Teams: ${result.teams.join(', ')}.`,
    `Betrachtungszeitraum: ${result.dateRange.start} bis ${result.dateRange.end}; Turniere: ${result.tournaments.length > 0 ? result.tournaments.join(', ') : 'alle Turniere'}; optimiert werden Live-Spiele.`,
    `Relevante Spiele: ${result.games.length}; ohne Angebot: ${result.unavailableGameIds.length}.`,
    `Empfehlung: ${result.recommended === 'annual' ? 'Jahreskombination' : 'monatsweise Staffelung'} für ${euro(option.totalCostCents)}.`,
    `Pakete: ${packages || 'keine kostenpflichtigen Pakete'}.`,
    `Ersparnis gegenüber der günstigsten reinen Jahresstrategie (${euro(result.referenceCostCents)}): ${euro(result.savingsCents)} (${result.savingsPercent} %).`
  ].join('\n');
}

function localAnswer(message: string, result: OptimizationResult): ChatResponse {
  const normalized = message.toLocaleLowerCase('de-DE');
  const option = result[result.recommended];
  if (/warum|wieso|kombination|paket/.test(normalized)) {
    const details = option.packages
      .map((item) => `${item.name} deckt ${item.coveredGameIds.length} Spiele ab und kostet ${euro(item.costCents)}`)
      .join('; ');
    return { answer: details ? `Die Kombination ist am günstigsten: ${details}.` : 'Für diese Auswahl ist kein bezahltes Paket nötig.', source: 'local' };
  }
  if (/spar|günst|preis|kost/.test(normalized)) {
    return {
      answer: `Die Empfehlung kostet ${euro(option.totalCostCents)}. Gegenüber der günstigsten reinen Jahresstrategie mit ${euro(result.referenceCostCents)} sparst du ${euro(result.savingsCents)} (${result.savingsPercent} %).`,
      source: 'local'
    };
  }
  if (/spiel|übertrag|live|highlight/.test(normalized)) {
    return {
      answer: `${result.games.length - result.unavailableGameIds.length} von ${result.games.length} Live-Spielen sind im gewählten Zeitraum abdeckbar. ${result.freeTv.length} kostenlose Anbieter übertragen mindestens eines davon.`,
      source: 'local'
    };
  }
  return {
    answer: `Für ${result.teams.join(', ')} empfehle ich ${option.packages.map((item) => item.name).join(' und ') || 'kein zusätzliches Paket'} für insgesamt ${euro(option.totalCostCents)}. Frage mich gern nach Kosten, Spielen oder dem Grund für die Auswahl.`,
    source: 'local'
  };
}

export async function answerQuestion(message: string, teams: string[], input: OptimizeInput): Promise<ChatResponse> {
  const result = await optimizeForTeams(teams, input);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return localAnswer(message, result);

  try {
    const openai = new OpenAI({ apiKey });
    const [chunks, queryEmbedding] = await Promise.all([
      loadEmbeddings(openai),
      openai.embeddings.create({ model: embeddingModel, input: message })
    ]);
    const relevant = chunks
      .map((chunk) => ({ ...chunk, score: cosineSimilarity(chunk.embedding, queryEmbedding.data[0].embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((chunk) => chunk.content)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Du bist der deutschsprachige Streaming-Berater dieser App. Antworte knapp und ausschließlich anhand des bereitgestellten Kontexts. Erfinde keine Preise oder Übertragungsrechte. Geldbeträge nennst du in Euro.'
        },
        { role: 'system', content: `Aktuelles Ergebnis:\n${resultContext(result)}\n\nAbgerufene Wissensbasis:\n${relevant}` },
        { role: 'user', content: message }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'select_teams',
            description: 'Ersetzt die aktuelle Teamauswahl, wenn der Nutzer ausdrücklich andere Teams analysieren möchte.',
            parameters: {
              type: 'object',
              properties: { teams: { type: 'array', items: { type: 'string' } } },
              required: ['teams'],
              additionalProperties: false
            },
            strict: true
          }
        }
      ]
    });
    const choice = response.choices[0].message;
    const toolCall = choice.tool_calls?.find(
      (call) => call.type === 'function' && call.function.name === 'select_teams'
    );
    if (toolCall?.type === 'function') {
      const requested = (JSON.parse(toolCall.function.arguments) as { teams: string[] }).teams;
      const validTeams = requested.flatMap((team) => listTeams(team, 1).filter((match) => match.toLocaleLowerCase('de-DE') === team.toLocaleLowerCase('de-DE')));
      if (validTeams.length > 0) {
        return {
          answer: `Ich habe die Auswahl auf ${validTeams.join(', ')} gesetzt.`,
          source: 'openai',
          action: { type: 'selectTeams', teams: validTeams }
        };
      }
    }
    return { answer: choice.content || localAnswer(message, result).answer, source: 'openai' };
  } catch (cause) {
    console.error('OpenAI-Anfrage fehlgeschlagen, lokaler Fallback wird verwendet.', cause);
    return localAnswer(message, result);
  }
}
