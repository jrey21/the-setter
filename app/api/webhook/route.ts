// app/api/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Lazy initialization to avoid build-time errors
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables');
    }
    
    supabaseAdmin = createClient(url, key);
  }
  return supabaseAdmin;
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('Webhook verification:', { mode, token, challenge });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    // Loop through all incoming events
    for (const entry of body.entry) {
      const instagramId = entry.id; // The Instagram account ID receiving the message

      if (entry.messaging) {
        for (const event of entry.messaging) {

          let senderId, recipientId, text, messageId, timestamp;

          // 1. Handle "message_edit"
          if (event.message_edit) {
            senderId = event.sender.id;
            recipientId = event.recipient.id;
            text = "(Message Edited)";
            messageId = event.message_edit.mid;
            timestamp = event.timestamp;
          }
          // 2. Handle standard "message"
          else if (event.message && !event.message.is_echo) {
            senderId = event.sender.id;
            recipientId = event.recipient.id;
            text = event.message.text || '(Attachment)';
            messageId = event.message.mid;
            timestamp = event.timestamp;
          }

          // If we found a valid message, save it
          if (messageId) {
            console.log(`Processing message from ${senderId} to ${recipientId}: ${text}`);
            console.log(`Instagram ID from entry: ${instagramId}`);

            const supabase = getSupabaseAdmin();

            // Find the account this message belongs to dynamically
            // The recipient_id is the Instagram account receiving the message
            // This should match the instagram_id stored in accounts table
            let accountId = null;
            
            // Strategy 1: Match by recipient_id (most reliable for incoming messages)
            if (recipientId) {
              const { data: acc } = await supabase
                .from('accounts')
                .select('id, instagram_id')
                .eq('instagram_id', recipientId)
                .single();
              if (acc) {
                accountId = acc.id;
                console.log('Found account by recipient_id:', acc);
              }
            }
            
            // Strategy 2: Match by entry.id (Instagram account ID from webhook payload)
            if (!accountId) {
              const { data: acc2 } = await supabase
                .from('accounts')
                .select('id, instagram_id')
                .eq('instagram_id', instagramId)
                .single();
              if (acc2) {
                accountId = acc2.id;
                console.log('Found account by entry ID:', acc2);
              }
            }
            
            // No fallback - if account not found, message won't be linked
            // This is correct for multi-user system
            if (!accountId) {
              console.log('No matching account found for recipient:', recipientId);
            }

            // Save to messages table
            const { error } = await supabase
              .from('messages')
              .upsert({
                instagram_message_id: messageId,
                sender_id: senderId,
                recipient_id: recipientId,
                message: text,
                message_type: 'text',
                instagram_timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
                account_id: accountId,
              }, { onConflict: 'instagram_message_id' });

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
    console.error('CRITICAL ERROR:', error.message);
    return new NextResponse('Error', { status: 500 });
  }
}