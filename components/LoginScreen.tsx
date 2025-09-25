import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocalization } from '../hooks/useLocalization';
import { FirebaseError } from 'firebase/app';
import LoadingSpinner from './icons/LoadingSpinner';

const LoginScreen: React.FC = () => {
    const { loginWithEmail, signupWithEmail, loginWithGoogle } = useAuth();
    const { t } = useLocalization();
    const [isLoginView, setIsLoginView] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleAuthError = (err: any) => {
        if (err instanceof FirebaseError) {
            switch (err.code) {
                case 'auth/invalid-credential':
                    setError(t('auth.errorInvalidCredentials'));
                    break;
                case 'auth/email-already-in-use':
                    setError(t('auth.errorEmailInUse'));
                    break;
                default:
                    setError(t('auth.errorGeneric'));
            }
        } else {
            setError(t('auth.errorGeneric'));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            if (isLoginView) {
                await loginWithEmail(email, password);
            } else {
                await signupWithEmail(email, password);
            }
        } catch (err) {
            handleAuthError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await loginWithGoogle();
        } catch (err) {
            handleAuthError(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-neutral-light p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl animate-fade-in">
                <h1 className="text-3xl font-bold text-center text-brand-dark mb-2">
                    {isLoginView ? t('auth.loginTitle') : t('auth.signupTitle')}
                </h1>
                <p className="text-center text-neutral-medium mb-8">
                    {isLoginView ? t('auth.loginDescription') : t('auth.signupDescription')}
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">{t('auth.emailLabel')}</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-light focus:border-brand-light sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="password">{t('auth.passwordLabel')}</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-light focus:border-brand-light sm:text-sm"
                        />
                    </div>
                    {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-dark disabled:bg-neutral-medium"
                    >
                        {isLoading ? <LoadingSpinner /> : (isLoginView ? t('auth.loginButton') : t('auth.signupButton'))}
                    </button>
                </form>

                <div className="my-6 flex items-center justify-center">
                    <div className="flex-grow border-t border-gray-300"></div>
                    <span className="mx-4 text-sm text-gray-500">{t('auth.or')}</span>
                    <div className="flex-grow border-t border-gray-300"></div>
                </div>

                <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-light disabled:bg-neutral-light"
                >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6.02C43.63 36.88 46.98 31.25 46.98 24.55z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6.02c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                    {t('auth.googleButton')}
                </button>

                <p className="mt-8 text-center text-sm text-gray-600">
                    <button onClick={() => { setIsLoginView(!isLoginView); setError(null); }} className="font-medium text-brand-primary hover:text-brand-dark">
                        {isLoginView ? t('auth.switchToSignup') : t('auth.switchToLogin')}
                    </button>
                </p>
            </div>
        </div>
    );
};

export default LoginScreen;