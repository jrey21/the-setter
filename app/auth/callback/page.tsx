'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Initializing...');
  const [debugError, setDebugError] = useState('');

  useEffect(() => {
    // 1. Get the Facebook Token from the URL immediately
    const hash = window.location.hash;
    if (!hash) {
      setDebugError('No token found in URL.');
      return;
    }
    const params = new URLSearchParams(hash.replace('#', '?'));
    const facebookToken = params.get('access_token');

    if (!facebookToken) {
      setDebugError('Token param was empty in the URL.');
      return;
    }

    setStatus('Waiting for user session...');

    // 2. THE FIX: Listen for the session to "wake up"
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Only run this once the user is confirmed!
        setStatus(`User confirmed (${session.user.email}). connecting...`);
        
        // Prevent double-calling
        if (!window.hasRunConnection) {
            window.hasRunConnection = true;
            await findInstagramAccount(facebookToken, session.user);
        }
      } else {
        // If still no user after a moment, we might really be logged out
        console.log('Session event:', event);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function findInstagramAccount(token: string, user: any) {
    try {
      setStatus('Fetching Facebook Pages...');

      // 3. Call Meta API
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${token}`
      );
      const data = await response.json();

      if (data.error) throw new Error(`Facebook API Error: ${data.error.message}`);
      if (!data.data || data.data.length === 0) throw new Error('No Facebook Pages found.');

      // 4. Find the connected page
      const connectedPage = data.data.find((page: any) => page.instagram_business_account);

      if (!connectedPage) {
        const pageNames = data.data.map((p: any) => p.name).join(', ');
        throw new Error(`Found pages (${pageNames}) but NONE have an Instagram connected.`);
      }

      setStatus(`Found linked Page: ${connectedPage.name}. Saving...`);

      // 5. Save to Supabase
      const { error: dbError } = await supabase.from('accounts').upsert({
        user_id: user.id,
        access_token: token,
        page_token: connectedPage.access_token,
        page_id: connectedPage.id,
        instagram_id: connectedPage.instagram_business_account.id,
        platform: 'instagram',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (dbError) throw new Error(`Database Error: ${dbError.message}`);

      setStatus('Success! Redirecting to Inbox...');
      setTimeout(() => router.push('/'), 1500);

    } catch (err: any) {
      console.error(err);
      setDebugError(err.message || JSON.stringify(err));
    }
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
      {!debugError && <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>}
      <h2 className={`text-xl font-bold ${debugError ? 'text-red-600' : 'text-gray-700'}`}>{status}</h2>
      
      {debugError && (
        <div className="mt-6 p-4 bg-red-100 border border-red-300 rounded-lg text-left max-w-2xl w-full">
            <p className="font-bold text-red-800 mb-2">ERROR:</p>
            <code className="text-sm text-red-700 font-mono break-all">{debugError}</code>
            
            {/* Fail-safe button if session is truly lost */}
            {debugError.includes('User') && (
                <button 
                  onClick={() => router.push('/login')}
                  className="mt-4 w-full bg-red-600 text-white py-2 rounded hover:bg-red-700"
                >
                  Go to Login (Try again)
                </button>
            )}
        </div>
      )}
    </div>
  );
}

// Helper to prevent double-firing in React Strict Mode
declare global {
    interface Window { hasRunConnection: boolean; }
}