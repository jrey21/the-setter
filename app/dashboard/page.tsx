'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(''); // To show connection status

  // ------------------------------------------------------------------
  // A. Define the Fetch Logic (Reusable)
  // ------------------------------------------------------------------
  const fetchInstagramMessages = async () => {
    setLoading(true);
    setError(null);

    // 1. Get the latest account from Supabase
    const { data: accounts, error: accError } = await supabase
      .from('accounts')
      .select('*')
      .order('id', { ascending: false })
      .limit(1);

    if (accError || !accounts || accounts.length === 0) {
      setError('No Instagram account connected yet.');
      setLoading(false);
      return;
    }

    const { access_token, instagram_id } = accounts[0]; // Note: using instagram_id usually, but let's stick to your logic

    // Detect if we stored 'instagram_business_id' or just 'instagram_id'
    // Your previous code used 'instagram_business_id', but the Auth flow saves 'instagram_id'. 
    // We will try to use the correct ID for the API call.
    const targetId = accounts[0].instagram_business_id || accounts[0].instagram_id;

    try {
      // 2. Fetch conversations (threads)
      const convRes = await axios.get(
        `https://graph.facebook.com/v18.0/${targetId}/conversations`,
        {
          params: {
            access_token,
            fields: 'id,participants',
            limit: 10,
            platform: 'instagram', // Good to specify platform
          },
        }
      );
      const conversations = convRes.data.data || [];

      // 3. For each conversation, fetch messages
      let allMessages: any[] = [];
      for (const conv of conversations) {
        const msgRes = await axios.get(
          `https://graph.facebook.com/v18.0/${conv.id}/messages`,
          {
            params: {
              access_token,
              fields: 'id,from,to,message,created_time',
              limit: 5, // Reduced limit slightly for speed during testing
            },
          }
        );
        const msgs = (msgRes.data.data || []).map((m: any) => ({
          ...m,
          conversation_id: conv.id,
          participants: conv.participants?.data || [],
        }));
        allMessages = allMessages.concat(msgs);
      }
      // Sort messages by created_time desc
      allMessages.sort((a, b) => (b.created_time > a.created_time ? 1 : -1));
      setMessages(allMessages);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch Instagram messages. Token might be expired or invalid.');
    }
    setLoading(false);
  };

  // ------------------------------------------------------------------
  // B. Main Initialization Effect (Connect -> Then Fetch)
  // ------------------------------------------------------------------
  useEffect(() => {
    const initDashboard = async () => {
      // 1. Check for Pending Connection (Rescue Token)
      const rescueToken = localStorage.getItem('rescue_token');
      
      if (rescueToken) {
        setStatus('Finishing Instagram connection...');
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          try {
            // Verify token with Facebook
            const response = await fetch(
              `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${rescueToken}`
            );
            const data = await response.json();
            
            // Find the page with Instagram linked
            const connectedPage = data.data?.find((p: any) => p.instagram_business_account);

            if (connectedPage) {
              // Save to Supabase
              await supabase.from('accounts').upsert({
                user_id: user.id,
                access_token: rescueToken,
                page_token: connectedPage.access_token,
                page_id: connectedPage.id,
                instagram_id: connectedPage.instagram_business_account.id, // This is crucial for fetching messages
                platform: 'instagram',
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id' });

              setStatus('Connected! Loading messages...');
              localStorage.removeItem('rescue_token'); // Clear it so we don't loop
            } else {
              setError("We connected to Facebook, but couldn't find a linked Instagram Business account.");
            }
          } catch (e) {
            console.error("Connection rescue failed", e);
          }
        }
      }

      // 2. Fetch Messages (Whether we just connected or were already connected)
      await fetchInstagramMessages();
      setStatus(''); // Clear status
    };

    initDashboard();
  }, []); // Run once on mount

  return (
    <div className="flex h-screen bg-white font-sans text-gray-900 overflow-hidden">
      {/* LEFT SIDEBAR: Message List */}
      <div className="w-1/3 min-w-[320px] max-w-100 border-r border-gray-200 flex flex-col bg-white">
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
           <h1 className="text-xl font-bold">Inbox</h1>
           <p className="text-xs text-gray-500 mt-1">Your Instagram messages</p>
           {status && <div className="mt-2 text-xs text-blue-600 font-medium animate-pulse">{status}</div>}
        </div>
        
        {/* Message List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-gray-400">Loading messages...</div>
          ) : error ? (
            <div className="p-4">
                <div className="text-red-500 text-sm mb-2">{error}</div>
                {error.includes('No Instagram') && (
                    <button 
                        onClick={() => router.push('/auth/callback')} // Send them back to connect if missing
                        className="text-blue-500 text-sm underline"
                    >
                        Connect Account Now
                    </button>
                )}
            </div>
          ) : messages.length === 0 ? (
            <div className="p-4 text-gray-400">No messages found.</div>
          ) : (
            messages.map((msg, idx) => (
              <div key={msg.id || idx} className="p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50" onClick={() => setSelectedChat(msg)}>
                <div className="font-semibold">{msg.from?.name || msg.from?.id || 'Unknown'}</div>
                <div className="text-xs text-gray-500">{msg.message?.slice(0, 40)}</div>
                <div className="text-[10px] text-gray-300 mt-1">{new Date(msg.created_time).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Chat View */}
      <div className="flex-1 flex flex-col">
        <div className="p-6 border-b border-gray-100 font-bold text-lg">Chat</div>
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedChat ? (
            <div>
              <div className="font-bold mb-2">{selectedChat.from?.name || selectedChat.from?.id}</div>
              <div className="mb-2 text-xs text-gray-400">{new Date(selectedChat.created_time).toLocaleString()}</div>
              <div>{selectedChat.message}</div>
              <div className="mt-4 text-xs text-gray-500">Participants: {selectedChat.participants.map((p: any) => p.name || p.id).join(', ')}</div>
            </div>
          ) : (
            <div className="text-gray-400">Select a message to view</div>
          )}
        </div>
      </div>
    </div>
  );
}