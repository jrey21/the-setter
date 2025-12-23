'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Verifying connection...');

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.replace('#', '?'));
    const token = params.get('access_token');

    if (token) {
      handleConnection(token);
    }
  }, []);

  async function handleConnection(token: string) {
    // 1. Try to see if we are still logged in
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // HAPPY PATH: User is logged in, save immediately
      saveAccount(token, user);
    } else {
      // RESCUE PATH: Session lost! Save token and go back to dashboard to recover
      setStatus('Session interrupted. Recovering...');
      localStorage.setItem('rescue_token', token);
      setTimeout(() => {
        router.push('/'); 
      }, 1000);
    }
  }

  async function saveAccount(token: string, user: any) {
    try {
      setStatus('Linking Instagram...');
      
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${token}`
      );
      const data = await response.json();

      const connectedPage = data.data?.find((p: any) => p.instagram_business_account);

      if (!connectedPage) {
        setStatus('Error: No Instagram account found linked to your Pages.');
        return;
      }

      await supabase.from('accounts').upsert({
        user_id: user.id,
        access_token: token,
        page_token: connectedPage.access_token,
        page_id: connectedPage.id,
        instagram_id: connectedPage.instagram_business_account.id,
        platform: 'instagram',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      setStatus('Success! Redirecting...');
      setTimeout(() => router.push('/'), 1500);

    } catch (err) {
      console.error(err);
      setStatus('Connection failed.');
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
}