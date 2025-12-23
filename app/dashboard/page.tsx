// app/dashboard/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import axios from 'axios';

export default function Dashboard() {
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch messages from Supabase (placeholder, will update to fetch from Instagram)
  useEffect(() => {
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
        setError('No Instagram account found. Please log in.');
        setLoading(false);
        return;
      }

      const { access_token, instagram_business_id } = accounts[0];
      try {
        // 2. Fetch conversations (threads)
        const convRes = await axios.get(
          `https://graph.facebook.com/v17.0/${instagram_business_id}/conversations`,
          {
            params: {
              access_token,
              fields: 'id,participants',
              limit: 10,
            },
          }
        );
        const conversations = convRes.data.data || [];

        // 3. For each conversation, fetch messages
        let allMessages: any[] = [];
        for (const conv of conversations) {
          const msgRes = await axios.get(
            `https://graph.facebook.com/v17.0/${conv.id}/messages`,
            {
              params: {
                access_token,
                fields: 'id,from,to,message,created_time',
                limit: 10,
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
      } catch {
        setError('Failed to fetch Instagram messages.');
      }
      setLoading(false);
    };
    fetchInstagramMessages();
  }, []);

  return (
    <div className="flex h-screen bg-white font-sans text-gray-900 overflow-hidden">
      {/* LEFT SIDEBAR: Message List */}
      <div className="w-1/3 min-w-[320px] max-w-100 border-r border-gray-200 flex flex-col bg-white">
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
           <h1 className="text-xl font-bold">Inbox</h1>
           <p className="text-xs text-gray-500 mt-1">Your Instagram messages</p>
        </div>
        {/* Message List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-gray-400">Loading messages...</div>
          ) : error ? (
            <div className="p-4 text-red-500">{error}</div>
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
