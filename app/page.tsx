'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Verifying connection...');

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) {
      setStatus('No token found. Please try connecting again.');
      return;
    }

    const params = new URLSearchParams(hash.replace('#', '?'));
    const accessToken = params.get('access_token');

    if (accessToken) {
      findInstagramAccount(accessToken);
    } else {
      setStatus('Error: Could not retrieve access token.');
    }
  }, []);

  async function findInstagramAccount(token: string) {
    try {
      setStatus('Looking for your Instagram account...');

      // 1. Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not logged in');

      // 2. Call Meta API to find connected pages
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${token}`
      );
      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        setStatus('Error: No Facebook Pages found.');
        return;
      }

      // 3. Find the page that has an 'instagram_business_account'
      const connectedPage = data.data.find((page: any) => page.instagram_business_account);

      if (!connectedPage) {
        setStatus('Error: This Page has no Instagram connected. Please link them in Instagram Settings.');
        return;
      }

      const instagramId = connectedPage.instagram_business_account.id;
      const pageId = connectedPage.id;
      const pageName = connectedPage.name;

      setStatus(`Found Instagram linked to ${pageName}! Saving...`);

      // 4. Save EVERYTHING to Supabase
      const { error } = await supabase.from('accounts').upsert({
        user_id: user.id,
        access_token: token,     // The main user token
        page_token: connectedPage.access_token, // The specific page token
        page_id: pageId,
        instagram_id: instagramId, // THIS IS THE KEY we need for messages
        platform: 'instagram',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }); // Updates if exists, inserts if new

      if (error) {
        console.error('Supabase Error:', error);
        setStatus('Database error. Check console.');
      } else {
        setStatus('Success! Redirecting to Inbox...');
        setTimeout(() => {
          router.push('/'); 
        }, 1500);
      }

    } catch (err) {
      console.error(err);
      setStatus('Failed to connect.');
    }
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <h2 className="text-xl font-semibold text-gray-700">{status}</h2>
      <p className="text-sm text-gray-400 mt-2">Do not close this window.</p>
    </div>
  );
}