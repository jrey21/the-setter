import { NextRequest, NextResponse } from 'next/server';

// This must match the string you will enter in the Meta Dashboard later
const VERIFY_TOKEN = 'setter-verification-token'; 

// 1. GET Request: Used by Meta to VERIFY your webhook (The Setup Step)
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      // You must return the challenge integer to verify
      return new NextResponse(challenge, { status: 200 });
    } else {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }
  return new NextResponse('Bad Request', { status: 400 });
}

// 2. POST Request: Used by Meta to SEND you messages (The Live Data)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Incoming Webhook:', JSON.stringify(body, null, 2));

    // Handle the message logic here later (save to DB, update UI, etc.)
    
    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  } catch (error) {
    return new NextResponse('Error', { status: 500 });
  }
}