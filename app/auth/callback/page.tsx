'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Verifying connection...');
  const [debugError, setDebugError] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) {
      setStatus('No token found in URL.');
      setDebugError('The URL does not contain an access_token. Did Facebook redirect correctly?');
      return;
    }

    const params = new URLSearchParams(hash.replace('#', '?'));
    const accessToken = params.get('access_token');

    if (accessToken) {
      findInstagramAccount(accessToken);
    } else {
      setStatus('Error: Could not retrieve access token.');
      setDebugError('Token param was empty in the URL.');
    }
  }, []);

  async function findInstagramAccount(token: string) {
    try {
      setStatus('Checking Supabase Session...');
      
      // 1. DEBUG: Check if user is actually logged in
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error('User is not logged in. Session might have expired.');
      }

      setStatus('Fetching Facebook Pages...');

      // 2. DEBUG: Call Meta API
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${token}`
      );
      const data = await response.json();

      if (data.error) {
        throw new Error(`Facebook API Error: ${data.error.message}`);
      }

      if (!data.data || data.data.length === 0) {
        throw new Error('No Facebook Pages found on this account.');
      }

      // 3. DEBUG: Find the connected page
      const connectedPage = data.data.find((page: any) => page.instagram_business_account);

      if (!connectedPage) {
        // Create a list of pages found to show the user
        const pageNames = data.data.map((p: any) => p.name).join(', ');
        throw new Error(`Found pages (${pageNames}) but NONE have an Instagram connected.`);
      }

      const instagramId = connectedPage.instagram_business_account.id;
      const pageId = connectedPage.id;

      setStatus(`Found Instagram linked to ${connectedPage.name}! Saving to database...`);

      // 4. DEBUG: Save to Supabase
      const { error: dbError } = await supabase.from('accounts').upsert({
        user_id: user.id,
        access_token: token,
        page_token: connectedPage.access_token,
        page_id: pageId,
        instagram_id: instagramId,
        platform: 'instagram',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (dbError) {
        throw new Error(`Supabase Database Error: ${dbError.message} (Details: ${dbError.details})`);
      }

      setStatus('Success! Redirecting to Inbox...');
      setTimeout(() => {
        router.push('/'); 
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setStatus('Failed to connect.');
      // PRINT THE REAL ERROR ON SCREEN
      setDebugError(err.message || JSON.stringify(err));
    }
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
      {!debugError && <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>}
      
      <h2 className={`text-xl font-bold ${debugError ? 'text-red-600' : 'text-gray-700'}`}>
        {status}
      </h2>

      {debugError && (
        <div className="mt-6 p-4 bg-red-100 border border-red-300 rounded-lg text-left max-w-2xl w-full">
          <p className="font-bold text-red-800 mb-2">ERROR DETAILS (Send this to support):</p>
          <code className="block whitespace-pre-wrap text-sm text-red-700 font-mono break-all">
            {debugError}
          </code>
        </div>
      )}
    </div>
  );
}