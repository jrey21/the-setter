'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Initializing...');
  const [hasRescueToken, setHasRescueToken] = useState(false);

  useEffect(() => {
    async function init() {
      // ---------------------------------------------------------
      // 0. IMMEDIATE: GRAB TOKEN FROM URL (The missing piece)
      // ---------------------------------------------------------
      // Facebook Implicit Flow returns token in the hash (#), not query (?)
      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1)); // remove the '#'
        const incomingToken = hashParams.get('access_token');
        
        if (incomingToken) {
          console.log("Token detected! Saving to rescue storage.");
          localStorage.setItem('rescue_token', incomingToken);
          // Clean the URL so users don't see the messy token
          window.history.replaceState(null, '', window.location.pathname);
        }
      }

      // ---------------------------------------------------------
      // 1. Check Login
      // ---------------------------------------------------------
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        console.log("User not logged in. Redirecting to login.");
        // OPTIONAL: Send them to login, but tell login to send them BACK here
        router.push('/login?next=/auth/callback'); 
        return;
      }

      setUser(user);
      setLoading(false);

      // ---------------------------------------------------------
      // 2. CHECK FOR RESCUE TOKEN (Now this will actually work)
      // ---------------------------------------------------------
      const token = localStorage.getItem('rescue_token');
      
      if (token) {
        setHasRescueToken(true);
        // Automatically try to finish since we have both User + Token
        finishConnection(token, user);
      } else {
        setStatus("No token found. Please click 'Connect' again.");
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
      
      // Look for the page that has an Instagram Business Account linked
      const connectedPage = data.data?.find((p: any) => p.instagram_business_account);

      if (connectedPage) {
        const { error } = await supabase.from('accounts').upsert({
          user_id: currentUser.id,
          access_token: token,
          page_token: connectedPage.access_token,
          page_id: connectedPage.id,
          instagram_id: connectedPage.instagram_business_account.id,
          platform: 'instagram',
          updated_at: new Date().toISOString(), // Good practice to track updates
        }, { onConflict: 'user_id' });

        if (error) throw error;
        
        setStatus('Instagram Connected Successfully!');
        localStorage.removeItem('rescue_token'); // Cleanup
        setHasRescueToken(false);
        
        // Success! Redirect to dashboard after a brief pause
        setTimeout(() => router.push('/dashboard'), 1500);
      } else {
        setStatus('Error: No Instagram Business account linked to your Facebook Page.');
      }
    } catch (e) {
      console.error(e);
      setStatus('Connection failed. Please try again.');
    }
  }

  const handleConnect = () => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    // Ensure this matches exactly what you put in Facebook Developer Console
    const redirectUri = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3000/auth/callback' 
      : 'https://the-setter.vercel.app/auth/callback';
      
    const scope = 'instagram_basic,instagram_manage_messages,pages_show_list,business_management';
    
    // Note: response_type=token returns the token in the HASH
    window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token`;
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50">Loading...</div>;

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">THE SETTER</h1>

        {/* Status Message */}
        {status && (
          <div className={`p-4 rounded-lg font-medium ${status.includes('Error') || status.includes('No token') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {status}
          </div>
        )}
        
        {/* Only show Connect button if we don't have a token yet */}
        {!hasRescueToken && (
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
        )}

        <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-sm text-gray-400 underline">
          Sign out
        </button>
      </div>
    </main>
  );
}