// app/api/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Webhook Received:', JSON.stringify(body, null, 2));

    // Iterate through entries
    for (const entry of body.entry) {
      if (entry.messaging) {
        for (const event of entry.messaging) {
          
          // HANDLE STANDARD MESSAGES
          if (event.message && !event.message.is_echo) {
            const senderId = event.sender.id;
            const text = event.message.text || '(Attachment/Sticker)';
            const messageId = event.message.mid;

            console.log(`Saving message from ${senderId}: ${text}`);

            const { error } = await supabase
              .from('messages')
              .insert([
                {
                  instagram_message_id: messageId,
                  sender_id: senderId,
                  message_text: text,
                  status: 'new',
                  created_at: new Date().toISOString()
                }
              ]);
              
            if (error) console.error('Supabase Error:', error);
          }
        }
      }
    }
    
    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  } catch (error) {
    return new NextResponse('Error', { status: 500 });
  }
}