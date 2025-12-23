// app/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  
  // -- APP STATE --
  const [session, setSession] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // -- INBOX STATE --
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);

  // 1. CHECK LOGIN & CONNECTION STATUS
  useEffect(() => {
    async function checkUser() {
      // A. Is user logged in?
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login'); // If not, kick them to login
        return;
      }
      setSession(session);

      // B. Do they have an Instagram Account linked?
      const { data: accounts } = await supabase.from('accounts').select('*').limit(1);
      
      if (accounts && accounts.length > 0) {
        setIsConnected(true);
        fetchMessages(); // If yes, load the messages
      } else {
        setIsConnected(false); // If no, we will show the "Connect" button later
      }
      setLoading(false);
    }

    checkUser();
  }, [router]);

  // 2. FETCH MESSAGES (Only runs if connected)
  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setMessages(data);

    // Real-time listener for new DMs
    const channel = supabase
      .channel('realtime messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((current) => [payload.new, ...current]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // 3. HANDLE "CONNECT INSTAGRAM" BUTTON
  const handleConnect = () => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const redirectUri = 'https://the-setter.vercel.app/auth/callback'; 
    const scope = 'instagram_basic,instagram_manage_messages,pages_manage_metadata,pages_show_list,business_management';
    
    // Redirect to Facebook Login
    window.location.href = `https://www.facebook.com/v17.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token`;
  };

  // -- VIEW 1: LOADING SCREEN --
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-2"></div>
        Loading Setter...
      </div>
    );
  }

  // -- VIEW 2: CONNECT INSTAGRAM (User is logged in, but no Instagram linked) --
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-pink-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Connect Your Inbox</h2>
          <p className="text-gray-500 mb-8">Link your Instagram Professional account to start receiving messages.</p>
          
          <button 
            onClick={handleConnect}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-md flex justify-center items-center gap-2"
          >
            Connect Instagram
          </button>
        </div>
      </div>
    );
  }

  // -- VIEW 3: THE INBOX (User is logged in AND connected) --
  return (
    <div className="flex h-screen bg-white font-sans text-gray-900 overflow-hidden">
      
      {/* LEFT SIDEBAR: Message List */}
      <div className="w-1/3 min-w-[320px] max-w-[400px] border-r border-gray-200 flex flex-col bg-white">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 bg-gray-50">
           <div className="flex justify-between items-center">
             <h1 className="text-xl font-bold">Inbox</h1>
             {/* Small logout button for testing */}
             <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-xs text-red-500 hover:underline">Logout</button>
           </div>
           <p className="text-xs text-gray-500 mt-1">Logged in as {session?.user?.email}</p>
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
          
          {/* Tabs */}
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
                  {msg.sender_id ? msg.sender_id.slice(0, 2) : '??'}
                </div>
                
                {/* Message Preview */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-semibold text-gray-900 truncate text-sm">User {msg.sender_id ? msg.sender_id.slice(0, 4) : 'Unknown'}...</h3>
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