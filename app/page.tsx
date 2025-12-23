'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in
  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
      }
      setLoading(false);
    }
    getUser();
  }, [router]);

  // THE FIXED CONNECT FUNCTION
  const handleConnect = () => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    
    // Auto-detect if we are on Localhost or Vercel
    const redirectUri = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3000/auth/callback' 
      : 'https://the-setter.vercel.app/auth/callback';

    // UPDATED SCOPES: Removed 'pages_manage_metadata' to fix the error
    const scope = 'instagram_basic,instagram_manage_messages,pages_show_list,business_management';

    if (!appId) {
      alert('Error: Missing Facebook App ID in Environment Variables.');
      return;
    }

    // Redirect to Facebook Login
    window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token`;
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        
        {/* Header / Logo Area */}
        <div>
          <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">THE SETTER</h1>
          <p className="mt-2 text-gray-600 text-lg">Your Automated DM Inbox</p>
        </div>

        {/* Main Card */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="space-y-6">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900">Connect Your Inbox</h2>
            <p className="text-gray-500">
              Connect your professional Instagram account to start receiving and managing messages.
            </p>

            <button
              onClick={handleConnect}
              className="w-full bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold py-4 px-6 rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Connect Instagram
            </button>
            
            <p className="text-xs text-gray-400 mt-4">
              Requires an Instagram Business account linked to a Facebook Page.
            </p>
          </div>
        </div>

        {/* Logout Option */}
        <button 
          onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
          className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
          Sign out
        </button>

      </div>
    </main>
  );
}