'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showManualToken, setShowManualToken] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [instagramId, setInstagramId] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [tokenError, setTokenError] = useState('');

  // Check if user is logged in and fetch account status
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      // Check if they have an Instagram account connected
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
      }
      
      setLoading(false);
    }
    init();
  }, [router]);

  // THE CONNECT FUNCTION
  const handleConnect = () => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    
    // Auto-detect if we are on Localhost or Vercel
    const redirectUri = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3000/auth/callback' 
      : 'https://the-setter.vercel.app/auth/callback';

    // Only use scopes that are enabled in your Meta app
    const scope = [
      'instagram_basic',
      'instagram_manage_messages', 
      'pages_show_list',
      'business_management'
    ].join(',');

    if (!appId) {
      alert('Error: Missing Facebook App ID in Environment Variables.');
      return;
    }

    // Redirect to Facebook Login
    window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token`;
  };

  // Manual token save function for Instagram Login API
  const handleSaveManualToken = async () => {
    if (!manualToken.trim()) {
      setTokenError('Please enter an access token');
      return;
    }
    
    setSavingToken(true);
    setTokenError('');
    
    try {
      // Verify the token by fetching user info
      const response = await fetch(
        `https://graph.instagram.com/v18.0/me?fields=id,username&access_token=${manualToken}`
      );
      const data = await response.json();
      
      if (data.error) {
        setTokenError(data.error.message);
        setSavingToken(false);
        return;
      }
      
      // Save to database
      const { error } = await supabase.from('accounts').upsert({
        user_id: user.id,
        access_token: manualToken,
        instagram_id: data.id,
        platform: 'instagram',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      
      if (error) throw error;
      
      // Success - reload to show connected state
      window.location.reload();
    } catch (e: any) {
      setTokenError(e.message || 'Failed to save token');
      setSavingToken(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-rose-500 flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} accountConnected={!!account} />
      
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}! 👋
            </h1>
            <p className="text-gray-500">
              {account ? 'Your Instagram account is connected and ready.' : 'Connect your Instagram to get started.'}
            </p>
          </div>

          {/* Stats Cards (if connected) */}
          {account && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="card p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">—</p>
                    <p className="text-sm text-gray-500">Total Messages</p>
                  </div>
                </div>
              </div>
              
              <div className="card p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">—</p>
                    <p className="text-sm text-gray-500">Active Leads</p>
                  </div>
                </div>
              </div>
              
              <div className="card p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">—</p>
                    <p className="text-sm text-gray-500">Avg Response Time</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connection Card */}
          <div className="card p-8">
            {account ? (
              // Connected State
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Instagram Connected</p>
                    <p className="text-sm text-gray-500">ID: {account.instagram_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="btn-primary"
                  >
                    Open Inbox
                  </button>
                </div>
              </div>
            ) : (
              // Not Connected State
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect your Instagram</h2>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">
                  Link your Instagram Business account to start managing your DMs from this dashboard.
                </p>
                
                <button
                  onClick={handleConnect}
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-bold py-4 px-8 rounded-2xl transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-pink-500/30"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                  </svg>
                  Connect Instagram
                </button>
                
                <p className="text-xs text-gray-400 mt-6">
                  Requires an Instagram Business account linked to a Facebook Page
                </p>
                
                {/* Manual Token Option */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setShowManualToken(!showManualToken)}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    {showManualToken ? '← Back to auto connect' : 'Or paste token manually (for development)'}
                  </button>
                  
                  {showManualToken && (
                    <div className="mt-4 text-left bg-gray-50 p-6 rounded-xl">
                      <h3 className="font-semibold text-gray-900 mb-2">Manual Token Setup</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Get your token from Meta Developer Console → Use cases → API setup with Instagram login → Generate access tokens
                      </p>
                      
                      {tokenError && (
                        <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-lg text-sm">
                          {tokenError}
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Paste your Instagram access token"
                          value={manualToken}
                          onChange={(e) => setManualToken(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          onClick={handleSaveManualToken}
                          disabled={savingToken || !manualToken.trim()}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
                        >
                          {savingToken ? 'Verifying & Saving...' : 'Save Token'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          {account && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="card p-6 text-left hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">View Inbox</p>
                      <p className="text-sm text-gray-500">Check your latest messages</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
                
                <button
                  onClick={handleConnect}
                  className="card p-6 text-left hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Reconnect Account</p>
                      <p className="text-sm text-gray-500">Refresh your connection</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}