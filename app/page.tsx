// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function Dashboard() {
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  // Check authentication and fetch messages
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setMessages(data);
    };
    fetchMessages();

    // Real-time listener
    const channel = supabase
      .channel('realtime messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((current) => [payload.new, ...current]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Welcome to The Setter</h2>
          <p className="mb-6">Please log in to access your dashboard.</p>
          <Link href="/login" className="inline-block bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-700 transition">Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white font-sans text-gray-900 overflow-hidden">
      {/* LEFT SIDEBAR: Message List */}
      <div className="w-1/3 min-w-[320px] max-w-[400px] border-r border-gray-200 flex flex-col bg-white">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
           <h1 className="text-xl font-bold">Inbox</h1>
           <p className="text-xs text-gray-500 mt-1">Your unified chat workspace</p>
        </div>

        {/* Search Bar */}
        <div className="p-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search threads..." 
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          
          {/* Tabs (All / Priority / Unread) */}
          <div className="flex gap-4 mt-4 text-sm font-medium text-gray-500 border-b border-gray-100 pb-2">
            <span className="text-black border-b-2 border-black pb-2 cursor-pointer">All [{messages.length}]</span>
            <span className="hover:text-black cursor-pointer">Priority [0]</span>
            <span className="hover:text-black cursor-pointer">Unread [0]</span>
          </div>
        </div>

        {/* List of Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
             <div className="p-8 text-center text-gray-400 text-sm">No messages yet...</div>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg.id} 
                onClick={() => setSelectedChat(msg)}
                className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer flex gap-3 transition-colors ${selectedChat?.id === msg.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
              >
                {/* Avatar Circle */}
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold shrink-0 text-sm">
                  {msg.sender_id.slice(0, 2)}
                </div>
                
                {/* Message Preview */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-semibold text-gray-900 truncate text-sm">User {msg.sender_id.slice(0, 4)}...</h3>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">{msg.message_text}</p>
                  
                  {/* Status Tag */}
                  <div className="mt-2 flex">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium ${msg.status === 'new' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {msg.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT MAIN AREA: Chat View or Empty State */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedChat ? (
          // ACTIVE CHAT VIEW
          <>
            <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm z-10">
              <h2 className="font-bold text-gray-800">User {selectedChat.sender_id}</h2>
              <button onClick={() => setSelectedChat(null)} className="text-sm text-gray-500 hover:text-red-500">Close</button>
            </div>
            <div className="flex-1 p-8 bg-gray-50 flex flex-col justify-end">
               {/* Bubble */}
               <div className="self-start bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 max-w-lg">
                 <p className="text-gray-800">{selectedChat.message_text}</p>
                 <p className="text-xs text-gray-400 mt-2 text-right">{new Date(selectedChat.created_at).toLocaleString()}</p>
               </div>
            </div>
            {/* Reply Input Placeholder */}
            <div className="p-4 bg-white border-t border-gray-200">
               <input type="text" placeholder="Type a reply..." className="w-full border border-gray-300 rounded-full px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </>
        ) : (
          // EMPTY STATE 
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
             <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
             </div>
             <h3 className="text-xl font-semibold text-gray-900 mb-2">It&apos;s empty here</h3>
             <p className="text-sm text-gray-500">Select a chat to see its info</p>
          </div>
        )}
      </div>
    </div>
  );
}