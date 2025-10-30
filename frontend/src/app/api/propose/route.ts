// frontend/src/app/api/propose/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, eventDescription } = body;
    if (!eventId || !eventDescription) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const res = await axios.post(`${BACKEND_URL}/propose`, body, { timeout: 30000 });
    return NextResponse.json(res.data);
  } catch (error: any) {
    console.error('Propose API error:', error);
    return NextResponse.json({ error: 'Failed to propose event' }, { status: 500 });
  }
}