import OpenAI from 'openai';

let client: OpenAI | null = null;
export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export async function generateMarketingPack(input: { businessName: string; businessType: string; goal: string; offer: string }) {
  const response = await getOpenAI().responses.create({
    model: 'gpt-5-mini',
    input: `You are WorkflowForge, an AI marketing operations assistant for a small business. Create a practical weekly marketing pack. Business: ${input.businessName}. Type: ${input.businessType}. Goal: ${input.goal}. Offer/focus: ${input.offer}. Return concise JSON with keys campaign, socialPosts (array of 3), reviewResponseTemplate, email, seoOpportunity, weeklySchedule (array of 5). Do not invent factual claims, prices, guarantees, testimonials, or business details.`,
    text: { format: { type: 'json_object' } }
  });
  return JSON.parse(response.output_text);
}