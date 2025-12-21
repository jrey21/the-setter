// app/login/page.tsx
'use client';

export default function LoginPage() {
  const handleLogin = () => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    // IMPORTANT: This must match what you put in Meta "Valid OAuth Redirect URIs"
    const redirectUri = 'https://the-setter.vercel.app/auth/callback'; 
    const scope = 'instagram_basic,instagram_manage_messages,pages_manage_metadata,pages_show_list,business_management';
    
    // Send user to Facebook
    window.location.href = `https://www.facebook.com/v17.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect Instagram</h1>
        <button 
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg mt-6"
        >
          Continue with Facebook
        </button>
      </div>
    </div>
  );
}