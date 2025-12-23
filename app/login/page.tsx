
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		const { error } = await supabase.auth.signInWithPassword({ email, password });
		setLoading(false);
		if (error) {
			setError(error.message);
		} else {
			router.push('/');
		}
	};

	const handleGoogleLogin = async () => {
		setLoading(true);
		setError(null);
		const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
		setLoading(false);
		if (error) setError(error.message);
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50">
			<form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
				<h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
				{error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
				<button
					type="button"
					onClick={handleGoogleLogin}
					className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-2 rounded font-semibold hover:bg-gray-100 transition mb-6 shadow-sm"
					disabled={loading}
				>
					<svg className="w-5 h-5" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C36.68 2.7 30.74 0 24 0 14.82 0 6.71 5.8 2.69 14.09l7.98 6.19C12.13 13.13 17.62 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.6C43.99 37.13 46.1 31.3 46.1 24.55z"/><path fill="#FBBC05" d="M10.67 28.28a14.5 14.5 0 0 1 0-8.56l-7.98-6.19A23.97 23.97 0 0 0 0 24c0 3.93.94 7.65 2.69 10.91l7.98-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.15 15.9-5.85l-7.19-5.6c-2 1.34-4.56 2.14-8.71 2.14-6.38 0-11.87-3.63-14.33-8.79l-7.98 6.19C6.71 42.2 14.82 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></g></svg>
					Continue with Google
				</button>
				<div className="mb-4">
					<label className="block mb-1 text-sm font-medium">Email</label>
					   <input
						   type="email"
						   className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
						   value={email}
						   onChange={e => setEmail(e.target.value)}
						   required
						   spellCheck={false}
						   autoCorrect="off"
						   autoCapitalize="none"
						   placeholder="Enter your email"
						   title="Email address"
					   />
				</div>
				<div className="mb-6">
					<label className="block mb-1 text-sm font-medium">Password</label>
					   <input
						   type="password"
						   className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
						   value={password}
						   onChange={e => setPassword(e.target.value)}
						   required
						   spellCheck={false}
						   autoCorrect="off"
						   autoCapitalize="none"
						   placeholder="Enter your password"
						   title="Password"
					   />
				</div>
				<button
					type="submit"
					className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition"
					disabled={loading}
				>
					{loading ? 'Logging in...' : 'Login'}
				</button>
			</form>
		</div>
	);
}
