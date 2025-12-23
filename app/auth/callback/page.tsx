'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [hasRescueToken, setHasRescueToken] = useState(false);

  useEffect(() => {
    async function init() {
      // 1. Check Login
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      setLoading(false);

      // 2. CHECK FOR RESCUE TOKEN
      const token = localStorage.getItem('rescue_token');
      if (token) {
        setHasRescueToken(true); // Show the "Finish" button
        // Try to auto-finish, but don't delete token yet in case it fails
        finishConnection(token, user);
      }
    }
    init();
  }, [router]);

  async function finishConnection(token: string, currentUser: any) {
    try {
      setStatus('Finishing connection...');
      
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${token}`
      );
      const data = await response.json();
      const connectedPage = data.data?.find((p: any) => p.instagram_business_account);

      if (connectedPage) {
        await supabase.from('accounts').upsert({
          user_id: currentUser.id,
          access_token: token,
          page_token: connectedPage.access_token,
          page_id: connectedPage.id,
          instagram_id: connectedPage.instagram_business_account.id,
          platform: 'instagram',
        }, { onConflict: 'user_id' });
        
        setStatus('Instagram Connected Successfully!');
        localStorage.removeItem('rescue_token'); // NOW we delete it
        setHasRescueToken(false);
      } else {
        setStatus('Error: Could not find a linked Instagram account.');
      }
    } catch (e) {
      console.error(e);
      setStatus('Connection failed. Please try again.');
    }
  }

  const handleConnect = () => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const redirectUri = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3000/auth/callback' 
      : 'https://the-setter.vercel.app/auth/callback';
    const scope = 'instagram_basic,instagram_manage_messages,pages_show_list,business_management';
    window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token`;
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50">Loading...</div>;

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        
        <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">THE SETTER</h1>
        
        {/* FAIL-SAFE BUTTON: Only shows if the connection was interrupted */}
        {hasRescueToken && (
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl shadow-sm">
            <h3 className="font-bold text-yellow-800 text-lg mb-2">Connection Interrupted?</h3>
            <p className="text-yellow-700 text-sm mb-4">
              We saved your Instagram key. Click below to finish the setup.
            </p>
            <button
              onClick={() => {
                const token = localStorage.getItem('rescue_token');
                if (token && user) finishConnection(token, user);
              }}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Complete Connection Now
            </button>
          </div>
        )}

        {/* Status Message */}
        {status && (
          <div className={`p-4 rounded-lg font-medium ${status.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {status}
          </div>
        )}

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Connect Your Inbox</h2>
            <button
              onClick={handleConnect}
              className="w-full bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg"
            >
              Connect Instagram
            </button>
          </div>
        </div>

        <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-sm text-gray-400 underline">
          Sign out
        </button>
      </div>
    </main>
  );
}