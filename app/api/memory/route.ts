import { NextResponse } from 'next/server';
import { forgetMemory } from '@/lib/cognee';

const COGNEE_API_URL = process.env.COGNEE_SERVICE_URL || process.env.COGNEE_API_URL || 'http://localhost:8000';
const COGNEE_API_KEY = process.env.COGNEE_API_KEY || '';

const isCloud = COGNEE_API_URL.includes('aws.cognee.ai') || COGNEE_API_URL.includes('api.cognee.ai');

const authHeaders: Record<string, string> = COGNEE_API_KEY
  ? {
      'X-Api-Key': COGNEE_API_KEY,
      ...(!isCloud ? { 'Authorization': `Bearer ${COGNEE_API_KEY}` } : {}),
    }
  : {};

export async function GET(req: Request) {
  try {
    const payload = {
      query: "Provide a high-level summary of the concepts I have uploaded and asked about so far.",
    };

    const response = await fetch(`${COGNEE_API_URL}/api/v1/recall`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      if (response.status === 409 || response.status === 404) {
        return NextResponse.json({ status: 'empty', summary: null });
      }
      throw new Error(`Cognee API returned ${response.status}${bodyText ? `: ${bodyText}` : ""}`);
    }

    const data = await response.json();
    
    const summaryText = Array.isArray(data) && data.length > 0 
      ? data.map((item: any) => item.text || item).join('\n\n') 
      : null;

    if (!summaryText || summaryText.trim() === "") {
       return NextResponse.json({ status: 'empty', summary: null });
    }

    return NextResponse.json({ 
      status: 'success', 
      summary: summaryText 
    });

  } catch (error) {
    console.error("Memory Fetch Error:", error);
    return NextResponse.json({ status: 'empty', summary: null }); 
  }
}

export async function DELETE() {
  try {
    await forgetMemory("learner_memory");
    return NextResponse.json({ status: 'success', message: 'Learning history forgotten' });
  } catch (error) {
    console.error("Forget error:", error);
    return NextResponse.json({ status: 'success', message: 'No history to forget or already empty' });
  }
}