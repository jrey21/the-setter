'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  
  // All useState hooks must be at the top, before any other logic
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Initializing...');
  const [hasRescueToken, setHasRescueToken] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loginStep, setLoginStep] = useState<'email' | 'otp'>('email');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  const connectionAttempted = useRef(false);

  // Finish Instagram connection
  async function finishConnection(token: string, currentUser: any) {
    try {
      setStatus('Fetching your Facebook Pages...');
      
      // First, let's check what permissions the token actually has
      const debugResponse = await fetch(
        `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${token}`
      );
      const debugData = await debugResponse.json();
      console.log('Token debug - User info:', debugData);
      
      // Check token permissions
      const permResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/permissions?access_token=${token}`
      );
      const permData = await permResponse.json();
      console.log('Token permissions:', permData);
      
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${token}`
      );
      const pagesData = await pagesResponse.json();
      
      console.log('Facebook Pages API Response:', pagesData);
      
      if (pagesData.error) {
        console.error('Facebook API Error:', pagesData.error);
        setStatus(`Error: ${pagesData.error.message}`);
        return;
      }
      
      if (!pagesData.data || pagesData.data.length === 0) {
        // More helpful error - check if they granted pages permission
        const hasPagesPerm = permData.data?.some((p: any) => p.permission === 'pages_show_list' && p.status === 'granted');
        if (!hasPagesPerm) {
          setStatus('Error: Pages permission was not granted. Please reconnect and check all permissions during Facebook login.');
        } else {
          setStatus('Error: No Facebook Pages found. Make sure you are an admin of a Facebook Page connected to your Instagram Business account.');
        }
        return;
      }
      
      const connectedPage = pagesData.data.find((p: any) => p.instagram_business_account);
      
      if (connectedPage) {
        console.log('Found Instagram Business Account:', connectedPage.instagram_business_account);
        
        const { error } = await supabase.from('accounts').upsert({
          user_id: currentUser.id,
          access_token: token,
          page_token: connectedPage.access_token,
          page_id: connectedPage.id,
          instagram_id: connectedPage.instagram_business_account.id,
          platform: 'instagram',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        if (error) throw error;
        
        setStatus(`Instagram Connected Successfully! (@${connectedPage.instagram_business_account.username || 'connected'})`);
        localStorage.removeItem('rescue_token');
        setHasRescueToken(false);
        
        setTimeout(() => router.push('/dashboard'), 1500);
      } else {
        const pageNames = pagesData.data.map((p: any) => p.name).join(', ');
        console.log('Pages found but none have Instagram:', pagesData.data);
        setStatus(`Error: Found ${pagesData.data.length} Facebook Page(s) (${pageNames}), but none have an Instagram Business account linked.`);
      }
    } catch (e) {
      console.error(e);
      setStatus('Connection failed. Please try again.');
    }
  }

  // Quick login handlers
  const handleSendOtp = async () => {
    setLoginLoading(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setLoginError(error.message);
    } else {
      setLoginStep('otp');
    }
    setLoginLoading(false);
  };

  const handleVerifyOtp = async () => {
    setLoginLoading(true);
    setLoginError('');
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    if (error) {
      setLoginError(error.message);
    } else if (data.session) {
      setUser(data.session.user);
      const existingToken = localStorage.getItem('rescue_token');
      if (existingToken) {
        await finishConnection(existingToken, data.session.user);
      }
    }
    setLoginLoading(false);
  };

  const handleConnect = () => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const redirectUri = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3000/auth/callback' 
      : 'https://the-setter.vercel.app/auth/callback';
      
    const scope = 'instagram_basic,instagram_manage_messages,pages_show_list,business_management';
    window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token`;
  };

  // Main effect - check auth and handle token
  useEffect(() => {
    // Grab token from URL hash immediately
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const incomingToken = hashParams.get('access_token');
      
      if (incomingToken) {
        console.log("Token detected! Saving to rescue storage.");
        localStorage.setItem('rescue_token', incomingToken);
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    async function checkAuthAndConnect() {
      setStatus('Checking authentication...');
      
      const existingToken = localStorage.getItem('rescue_token');
      console.log('Rescue token exists:', !!existingToken);
      
      if (existingToken) {
        setHasRescueToken(true);
      }
      
      // Try to get session with retries
      let session = null;
      for (let i = 0; i < 5; i++) {
        const { data, error } = await supabase.auth.getSession();
        console.log(`Session check attempt ${i + 1}:`, data?.session ? 'Found' : 'Not found', error?.message || '');
        session = data.session;
        if (session) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setLoading(false);
      
      if (session && session.user) {
        console.log('User authenticated:', session.user.email);
        setUser(session.user);
        
        if (existingToken && !connectionAttempted.current) {
          connectionAttempted.current = true;
          await finishConnection(existingToken, session.user);
        } else if (!existingToken) {
          setStatus("No Facebook token found. Please click 'Connect' again from the home page.");
        }
      } else {
        console.log('No session found');
        if (existingToken) {
          setStatus('Session expired. Please log in below to complete the connection.');
        } else {
          setStatus('Please log in first, then connect your Instagram account.');
        }
      }
    }
    
    checkAuthAndConnect();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">THE SETTER</h1>

        {/* Status Message */}
        {status && (
          <div className={`p-4 rounded-lg font-medium ${
            status.includes('Error') || status.includes('expired') || status.includes('No ') 
              ? 'bg-red-100 text-red-700' 
              : status.includes('Success') 
                ? 'bg-green-100 text-green-700' 
                : 'bg-blue-100 text-blue-700'
          }`}>
            {status}
          </div>
        )}
        
        {/* Show inline login if we have rescue token but no session */}
        {hasRescueToken && !user && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-left">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Login to Complete Connection</h2>
            <p className="text-sm text-gray-500 mb-4">Your Instagram is authorized. Just log in to finish.</p>
            
            {loginError && (
              <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-lg text-sm">{loginError}</div>
            )}
            
            {loginStep === 'email' ? (
              <div className="space-y-4">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendOtp}
                  disabled={loginLoading || !email}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
                >
                  {loginLoading ? 'Sending...' : 'Send Code'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Check your email for the code</p>
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                  maxLength={6}
                />
                <button
                  onClick={handleVerifyOtp}
                  disabled={loginLoading || otp.length !== 6}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
                >
                  {loginLoading ? 'Verifying...' : 'Verify & Connect'}
                </button>
                <button onClick={() => setLoginStep('email')} className="text-sm text-gray-400 underline">
                  Use different email
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Show Connect button if we don't have a token */}
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

        <button 
          onClick={() => supabase.auth.signOut().then(() => {
            localStorage.removeItem('rescue_token');
            router.push('/login');
          })} 
          className="text-sm text-gray-400 underline"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
