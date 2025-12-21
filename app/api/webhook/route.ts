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
      // Check if it is a messaging event
      if (entry.messaging) {
        for (const event of entry.messaging) {
          
          // 1. Handle "message_edit" (The quirk you saw earlier)
          // We treat edits as new messages for simplicity so you don't miss them
          if (event.message_edit) {
             const senderId = event.sender.id;
             const text = "(Message Edited)"; 
             const messageId = event.message_edit.mid;
             
             await supabase.from('messages').insert([{
                instagram_message_id: messageId,
                sender_id: senderId,
                message_text: text,
                status: 'edited'
             }]);
          }

          // 2. Handle standard "message"
          else if (event.message && !event.message.is_echo) {
            const senderId = event.sender.id;
            const text = event.message.text || '(Attachment)';
            const messageId = event.message.mid;

            await supabase.from('messages').insert([{
                instagram_message_id: messageId,
                sender_id: senderId,
                message_text: text,
                status: 'new'
            }]);
          }
        }
      }
    }
    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  } catch (error) {
    return new NextResponse('Error', { status: 500 });
  }
}