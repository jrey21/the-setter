// app/auth/callback/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function CallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    // 1. Get the token from the URL hash
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', '?'));
    const accessToken = params.get('access_token');

    if (accessToken) {
      saveAccount(accessToken);
    } else {
      setStatus('Error: No token found.');
    }
  }, []);

  const saveAccount = async (token: string) => {
    try {
      setStatus('Finding your Instagram page...');
      
      // 2. Ask Facebook for the user's pages
      const response = await fetch(`https://graph.facebook.com/v17.0/me/accounts?access_token=${token}`);
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        const page = data.data[0]; // Get the first page
        
        // 3. Get the Instagram ID linked to this page
        const igReq = await fetch(`https://graph.facebook.com/v17.0/${page.id}?fields=instagram_business_account&access_token=${token}`);
        const igData = await igReq.json();

        if (igData.instagram_business_account) {
            // 4. Save everything to Supabase
            await supabase.from('accounts').upsert({
                instagram_business_id: igData.instagram_business_account.id,
                page_name: page.name,
                access_token: token
            }, { onConflict: 'instagram_business_id' });

            setStatus('Success! Redirecting...');
            router.push('/'); // Send them to the Dashboard
        } else {
            setStatus('Error: This Page has no Instagram connected.');
        }
      } else {
        setStatus('Error: No Facebook Pages found.');
      }
    } catch (err) {
      setStatus('Connection Failed.');
    }
  };

  return <div className="p-10 text-center font-bold">{status}</div>;
}