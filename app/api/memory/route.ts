// app/api/memory/route.ts
import { NextResponse } from 'next/server';

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
      throw new Error(`Cognee API returned ${response.status}`);
    }

    const data = await response.json();
    
    // 3. Cognee returns an array of results. We extract the text.
    const summaryText = Array.isArray(data) && data.length > 0 
      ? data.map((item: any) => item.text || item).join('\n\n') 
      : null;

    // 4. If Cognee hasn't processed the graph yet, trigger the empty state in MemoryPanel
    if (!summaryText || summaryText.trim() === "") {
       return NextResponse.json({ status: 'empty', summary: null });
    }

    // 5. Success! Send the summary to your React component
    return NextResponse.json({ 
      status: 'success', 
      summary: summaryText 
    });

  } catch (error) {
    console.error("Memory Fetch Error:", error);
    // Returning 'empty' gracefully prevents UI crashes if the Python server is asleep
    return NextResponse.json({ status: 'empty', summary: null }); 
  }
}

export async function DELETE() {
  try {
    // To wire up your "Forget my learning history" button
    const response = await fetch(`${COGNEE_API_URL}/api/v1/datasets`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      // Pass the target dataset you want to wipe
      // body: JSON.stringify({ datasetName: "studymind_main" }) 
    });

    return NextResponse.json({ status: 'empty', summary: null });
  } catch (error) {
    return NextResponse.json({ status: 'error', error: String(error) }, { status: 500 });
  }
}