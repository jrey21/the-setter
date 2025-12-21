// app/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [messages, setMessages] = useState<any[]>([]);

  // Fetch messages when the page loads
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) setMessages(data);
    };

    fetchMessages();

    // OPTIONAL: Real-time listener (messages appear instantly without refresh)
    const channel = supabase
      .channel('realtime messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((current) => [payload.new, ...current]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-6 text-blue-900">The Setter Inbox</h1>
      
      <div className="space-y-4">
        {messages.length === 0 ? (
          <p className="text-gray-500">No messages yet. Send a DM to @setterlabs to test!</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="border p-4 rounded-lg shadow bg-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-800">Sender ID: {msg.sender_id}</h3>
                <p className="text-lg text-gray-800 mt-1">{msg.message_text}</p>
                <span className="text-xs text-gray-400">
                  {new Date(msg.created_at).toLocaleString()}
                </span>
              </div>
              <span className={`px-3 py-1 rounded text-sm ${msg.status === 'new' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                {msg.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}