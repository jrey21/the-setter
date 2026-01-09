'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

interface Conversation {
  id: string;
  participants: { id: string; name?: string; username?: string; email?: string }[];
  lastMessage?: Message;
  unreadCount?: number;
  updated_time?: string;
}

interface Message {
  id: string;
  from: { id: string; name?: string; username?: string; email?: string };
  to?: { data: { id: string; name?: string }[] };
  message: string;
  created_time: string;
  conversation_id: string;
  participants: { id: string; name?: string; username?: string }[];
}

interface WebhookMessage {
  id: string;
  instagram_message_id: string;
  sender_id: string;
  sender_username?: string;
  recipient_id?: string;
  message: string;
  message_type: string;
  instagram_timestamp?: string;
  created_at: string;
  account_id?: string;
}

export default function Dashboard() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [webhookMessages, setWebhookMessages] = useState<WebhookMessage[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversationMessages]);

  // ------------------------------------------------------------------
  // Fetch Instagram Conversations from Graph API
  // ------------------------------------------------------------------
  const fetchInstagramConversations = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUser(user);

    const { data: accounts, error: accError } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (accError || !accounts || accounts.length === 0) {
      setError('No Instagram account connected.');
      setLoading(false);
      return;
    }

    const account = accounts[0];
    setAccountInfo(account);
    
    // Determine which token to use
    // If page_token exists, we connected via Facebook Login (has page access)
    // If only access_token exists, we connected via Instagram Login or manual token
    const tokenToUse = account.page_token || account.access_token;
    const targetId = account.instagram_business_id || account.instagram_id;
    const isInstagramLoginToken = !account.page_token;

    if (!targetId) {
      setError('Instagram Business ID not found.');
      setLoading(false);
      return;
    }

    try {
      // For Instagram Login tokens, we can't fetch conversations via API
      // Instead, we rely on webhook messages stored in our database
      if (isInstagramLoginToken) {
        console.log('Using Instagram Login token - fetching messages from database');
        await fetchWebhookMessages();
        setLoading(false);
        return;
      }
      
      // For Facebook Login tokens, use graph.facebook.com
      const baseUrl = 'https://graph.facebook.com/v18.0';
      
      const convRes = await axios.get(
        `${baseUrl}/${targetId}/conversations`,
        {
          params: {
            access_token: tokenToUse,
            fields: 'id,participants,updated_time',
            limit: 25,
            platform: 'instagram',
          },
        }
      );
      
      const conversationsData = convRes.data.data || [];
      const conversationsWithMessages: Conversation[] = [];
      
      for (const conv of conversationsData) {
        try {
          const msgRes = await axios.get(
            `${baseUrl}/${conv.id}/messages`,
            {
              params: {
                access_token: tokenToUse,
                fields: 'id,from,to,message,created_time',
                limit: 1,
              },
            }
          );
          
          const lastMsg = msgRes.data.data?.[0];
          conversationsWithMessages.push({
            id: conv.id,
            participants: conv.participants?.data || [],
            updated_time: conv.updated_time,
            lastMessage: lastMsg ? {
              ...lastMsg,
              conversation_id: conv.id,
              participants: conv.participants?.data || [],
            } : undefined,
          });
        } catch {
          conversationsWithMessages.push({
            id: conv.id,
            participants: conv.participants?.data || [],
            updated_time: conv.updated_time,
          });
        }
      }
      
      setConversations(conversationsWithMessages);
      await fetchWebhookMessages();
      
    } catch (err: any) {
      console.error('Error fetching conversations:', err);
      const errorMessage = err.response?.data?.error?.message || 'Failed to fetch messages.';
      const errorCode = err.response?.data?.error?.code;
      
      // Provide helpful guidance for common errors
      if (errorCode === 3 || errorMessage.includes('capability')) {
        setError(`(#${errorCode}) ${errorMessage}`);
      } else if (errorCode === 190 || errorMessage.includes('access token')) {
        setError('Access token expired. Please reconnect your Instagram account.');
      } else {
        setError(errorMessage);
      }
    }
    setLoading(false);
  }, [router]);

  // ------------------------------------------------------------------
  // Fetch Messages for a Specific Conversation
  // ------------------------------------------------------------------
  const fetchConversationMessages = async (conversationId: string) => {
    if (!accountInfo) return;
    
    setLoadingMessages(true);
    const tokenToUse = accountInfo.page_token || accountInfo.access_token;
    
    // Use Instagram API for Instagram Login tokens (no page_token)
    const isInstagramLoginToken = !accountInfo.page_token;
    const baseUrl = isInstagramLoginToken 
      ? 'https://graph.instagram.com/v18.0'
      : 'https://graph.facebook.com/v18.0';
    
    try {
      const msgRes = await axios.get(
        `${baseUrl}/${conversationId}/messages`,
        {
          params: {
            access_token: tokenToUse,
            fields: 'id,from,to,message,created_time',
            limit: 50,
          },
        }
      );
      
      const msgs: Message[] = (msgRes.data.data || []).map((m: any) => ({
        ...m,
        conversation_id: conversationId,
        participants: [],
      }));
      
      msgs.sort((a, b) => new Date(a.created_time).getTime() - new Date(b.created_time).getTime());
      setConversationMessages(msgs);
    } catch (err: any) {
      console.error('Error fetching messages:', err);
    }
    setLoadingMessages(false);
  };

  // ------------------------------------------------------------------
  // Fetch Webhook Messages from Supabase (grouped by sender)
  // ------------------------------------------------------------------
  const fetchWebhookMessages = async () => {
    if (!accountInfo) return;
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('account_id', accountInfo.id)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (!error && data) {
      setWebhookMessages(data);
      
      // Group messages by sender to create "conversations"
      const grouped = data.reduce((acc: any, msg: any) => {
        const key = msg.sender_id;
        if (!acc[key]) {
          acc[key] = {
            id: key,
            participants: [{ id: key, username: msg.sender_username || key }],
            updated_time: msg.created_at,
            lastMessage: msg,
            messages: [],
          };
        }
        acc[key].messages.push(msg);
        return acc;
      }, {});
      
      // Convert to array and set as conversations if no API conversations
      const webhookConvs = Object.values(grouped) as Conversation[];
      if (conversations.length === 0 && webhookConvs.length > 0) {
        setConversations(webhookConvs);
      }
    }
  };

  // ------------------------------------------------------------------
  // Handle Conversation Selection
  // ------------------------------------------------------------------
  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    
    // Check if this is a webhook-based conversation (sender_id as id)
    const isWebhookConv = !conv.id.includes('_'); // API conv IDs usually have underscores
    
    if (isWebhookConv && accountInfo) {
      // Fetch messages from database for this sender
      setLoadingMessages(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('account_id', accountInfo.id)
        .eq('sender_id', conv.id)
        .order('created_at', { ascending: true });
      
      if (!error && data) {
        // Convert webhook messages to Message format
        const msgs: Message[] = data.map((m: any) => ({
          id: m.instagram_message_id || m.id,
          from: { id: m.sender_id, username: m.sender_username },
          message: m.message,
          created_time: m.instagram_timestamp || m.created_at,
          conversation_id: conv.id,
          participants: conv.participants,
        }));
        setConversationMessages(msgs);
      }
      setLoadingMessages(false);
    } else {
      // Use API for Facebook Login conversations
      fetchConversationMessages(conv.id);
    }
  };

  // ------------------------------------------------------------------
  // Initialization
  // ------------------------------------------------------------------
  useEffect(() => {
    const init = async () => {
      const rescueToken = localStorage.getItem('rescue_token');
      
      if (rescueToken) {
        setStatus('Finishing connection...');
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          try {
            const response = await fetch(
              `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${rescueToken}`
            );
            const data = await response.json();
            const connectedPage = data.data?.find((p: any) => p.instagram_business_account);

            if (connectedPage) {
              await supabase.from('accounts').upsert({
                user_id: user.id,
                access_token: rescueToken,
                page_token: connectedPage.access_token,
                page_id: connectedPage.id,
                instagram_id: connectedPage.instagram_business_account.id,
                platform: 'instagram',
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id' });

              setStatus('Connected!');
              localStorage.removeItem('rescue_token');
            }
          } catch (e) {
            console.error("Connection failed", e);
          }
        }
      }

      await fetchInstagramConversations();
      setStatus('');
    };

    init();
  }, [fetchInstagramConversations]);

  // ------------------------------------------------------------------
  // Real-time subscription for new messages
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!accountInfo?.id) return;

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `account_id=eq.${accountInfo.id}`,
        },
        (payload) => {
          console.log('New message received:', payload);
          // Refresh conversations when new message arrives
          fetchWebhookMessages();
          
          // If viewing this conversation, add the message
          if (selectedConversation && payload.new.sender_id === selectedConversation.id) {
            const newMsg: Message = {
              id: payload.new.instagram_message_id || payload.new.id,
              from: { id: payload.new.sender_id, username: payload.new.sender_username },
              message: payload.new.message,
              created_time: payload.new.instagram_timestamp || payload.new.created_at,
              conversation_id: selectedConversation.id,
              participants: selectedConversation.participants,
            };
            setConversationMessages(prev => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountInfo?.id, selectedConversation]);

  // Helper functions
  const getOtherParticipant = (conv: Conversation) => {
    if (!accountInfo) return conv.participants[0];
    const instagramId = accountInfo.instagram_id;
    return conv.participants.find(p => p.id !== instagramId) || conv.participants[0];
  };

  const isFromMe = (message: Message) => {
    if (!accountInfo) return false;
    return message.from?.id === accountInfo.instagram_id;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const participant = getOtherParticipant(conv);
    const name = participant?.name || participant?.username || participant?.id || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} accountConnected={!!accountInfo} />
      
      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Conversation List */}
        <div className="w-96 bg-white border-r border-gray-100 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-gray-900">Inbox</h1>
              <div className="flex items-center gap-2">
                <button 
                  onClick={fetchInstagramConversations}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Refresh"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {status && (
              <div className="mt-3 text-xs text-indigo-600 font-medium animate-pulse flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {status}
              </div>
            )}
          </div>
          
          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                <p>Loading conversations...</p>
              </div>
            ) : error ? (
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-gray-900 font-medium mb-2">Connection Error</p>
                <p className="text-sm text-gray-500 mb-4">{error}</p>
                <button 
                  onClick={() => router.push('/')}
                  className="btn-primary text-sm"
                >
                  Connect Instagram
                </button>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-rose-100 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-700 text-lg mb-2">Waiting for messages...</p>
                <p className="text-sm text-center text-gray-500 max-w-xs">
                  Your inbox is connected! Send a DM to your Instagram account from another account to test.
                </p>
                <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 max-w-xs">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-amber-700">
                      Make sure webhooks are configured in Meta Developer Console to receive real-time messages.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => fetchInstagramConversations()}
                  className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const participant = getOtherParticipant(conv);
                const isSelected = selectedConversation?.id === conv.id;
                
                return (
                  <div 
                    key={conv.id} 
                    className={`p-4 cursor-pointer transition-all border-b border-gray-50 ${
                      isSelected 
                        ? 'bg-indigo-50 border-l-4 border-l-indigo-500' 
                        : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                    }`}
                    onClick={() => handleSelectConversation(conv)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-rose-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {(participant?.name || participant?.username || participant?.id || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-semibold truncate ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                            {participant?.name || participant?.username || `User ${participant?.id?.slice(-6)}`}
                          </span>
                          {conv.lastMessage && (
                            <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                              {formatTime(conv.lastMessage.created_time)}
                            </span>
                          )}
                        </div>
                        {conv.lastMessage && (
                          <p className="text-sm text-gray-500 truncate">
                            {conv.lastMessage.message || '(Attachment)'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Webhook Messages Badge */}
          {webhookMessages.length > 0 && (
            <div className="p-4 border-t border-gray-100 bg-amber-50">
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="font-medium">{webhookMessages.length} webhook messages</span>
              </div>
            </div>
          )}
        </div>

        {/* Chat View */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-100 bg-white flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-rose-400 flex items-center justify-center text-white font-semibold">
                  {(getOtherParticipant(selectedConversation)?.name || 
                    getOtherParticipant(selectedConversation)?.username || 
                    getOtherParticipant(selectedConversation)?.id || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-gray-900">
                    {getOtherParticipant(selectedConversation)?.name || 
                     getOtherParticipant(selectedConversation)?.username || 
                     `User ${getOtherParticipant(selectedConversation)?.id?.slice(-6)}`}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Instagram • {getOtherParticipant(selectedConversation)?.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="View profile">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="More options">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                      <p className="text-gray-400">Loading messages...</p>
                    </div>
                  </div>
                ) : conversationMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No messages in this conversation.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {conversationMessages.map((msg, index) => {
                      const fromMe = isFromMe(msg);
                      const showAvatar = index === 0 || 
                        conversationMessages[index - 1]?.from?.id !== msg.from?.id;
                      
                      return (
                        <div 
                          key={msg.id}
                          className={`flex ${fromMe ? 'justify-end' : 'justify-start'} animate-fade-in`}
                        >
                          <div className={`flex items-end gap-2 max-w-[70%] ${fromMe ? 'flex-row-reverse' : ''}`}>
                            {!fromMe && showAvatar && (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-rose-400 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                {(msg.from?.name || msg.from?.id || '?')[0].toUpperCase()}
                              </div>
                            )}
                            {!fromMe && !showAvatar && <div className="w-8"></div>}
                            <div className={`rounded-2xl px-4 py-3 ${
                              fromMe 
                                ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-br-md' 
                                : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md shadow-sm'
                            }`}>
                              <p className="text-sm leading-relaxed">{msg.message || '(No content)'}</p>
                              <p className={`text-[10px] mt-1 ${fromMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                                {new Date(msg.created_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
              
              {/* Message Input */}
              <div className="p-4 border-t border-gray-100 bg-white">
                <div className="flex items-center gap-3">
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  <input 
                    type="text" 
                    placeholder="Type a message..." 
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled
                  />
                  <button 
                    className="p-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">
                  Sending messages coming soon
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Select a conversation</h2>
                <p className="text-gray-500 max-w-sm">
                  Choose a conversation from the left to view and respond to messages.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
