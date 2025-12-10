import OpenAI from 'openai';

const systemPrompt = `You are a chart generator for Linear issues. Available fields: id, title, createdAt, completedAt, state{type}, assignee{name}, priority, labels{name}, team{name}, estimate.
User wants: "{prompt}"
Respond ONLY with valid JSON:{"type": "bar|line|pie|donut|scatter","title": "string","xAxis": "week|priority|assignee|stateType|severity","yAxis": "count|avgEstimate|sumEstimate","groupBy": "priority|team|severity|null","filter": "type=bug&state=open"  // optional}`;

export type ChartSpec = {
  type: 'bar' | 'line' | 'pie' | 'donut' | 'scatter';
  title: string;
  xAxis: 'week' | 'priority' | 'assignee' | 'stateType' | 'severity';
  yAxis: 'count' | 'avgEstimate' | 'sumEstimate';
  groupBy: 'priority' | 'team' | 'severity' | 'null' | null;
  filter?: string;
};

export async function generateChartSpec(apiKey: string, prompt: string): Promise<ChartSpec> {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt.replace('{prompt}', prompt) },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const messageContent = completion.choices[0]?.message?.content;
  if (!messageContent) throw new Error('OpenAI returned empty content');

  try {
    const parsed = JSON.parse(messageContent) as ChartSpec;
    return parsed;
  } catch (err) {
    throw new Error('OpenAI returned invalid JSON');
  }
}
