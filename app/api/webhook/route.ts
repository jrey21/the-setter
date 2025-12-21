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
    
    // Loop through all incoming events
    for (const entry of body.entry) {
      if (entry.messaging) {
        for (const event of entry.messaging) {
          
          let senderId, text, messageId;

          // 1. Handle "message_edit"
          if (event.message_edit) {
             senderId = event.sender.id;
             text = "(Message Edited)"; 
             messageId = event.message_edit.mid;
          }
          // 2. Handle standard "message"
          else if (event.message && !event.message.is_echo) {
             senderId = event.sender.id;
             text = event.message.text || '(Attachment)';
             messageId = event.message.mid;
          }

          // If we found a valid message, save it
          if (messageId) {
            console.log(`Processing message from ${senderId}: ${text}`);

            // UPSERT: This prevents "Duplicate Key" crashes
            const { error } = await supabase
              .from('messages')
              .upsert({
                instagram_message_id: messageId,
                sender_id: senderId,
                message_text: text,
                status: 'new'
              }, { onConflict: 'instagram_message_id' }); // <--- Crucial Fix

            if (error) {
              console.error('Supabase Error:', error);
            } else {
              console.log('Success: Saved to Supabase');
            }
          }
        }
      }
    }
    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  } catch (error: any) {
    // Log the REAL error so we can see it in Vercel logs
    console.error('CRITICAL ERROR:', error.message);
    return new NextResponse('Error', { status: 500 });
  }
}