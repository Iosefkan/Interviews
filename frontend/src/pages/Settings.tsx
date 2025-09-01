import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { LoadingStates } from '../components/ui/LoadingStates';
import type { FormErrors } from '../types';

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ProfileFormData {
  name: string;
  email: string;
}

const Settings: React.FC = () => {
  const { user, changePassword, updateProfile, logout } = useAuth();
  const { t, currentLanguage, changeLanguage, supportedLanguages } = useLanguage();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'language'>('profile');
  
  // Language form state
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);
  const [languageSuccess, setLanguageSuccess] = useState('');
  const [languageError, setLanguageError] = useState('');

  // Profile form state
  const [profileData, setProfileData] = useState<ProfileFormData>({
    name: user?.name || '',
    email: user?.email || ''
  });
  const [profileErrors, setProfileErrors] = useState<FormErrors>({});
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  
  // Password form state
  const [passwordData, setPasswordData] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState<FormErrors>({});
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const validateProfileForm = (): boolean => {
    const errors: FormErrors = {};

    if (!profileData.name.trim()) {
      errors.name = t('settings.validation.nameRequired');
    }

    if (!profileData.email.trim()) {
      errors.email = t('settings.validation.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(profileData.email)) {
      errors.email = t('settings.validation.emailInvalid');
    }

    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePasswordForm = (): boolean => {
    const errors: FormErrors = {};

    if (!passwordData.currentPassword) {
      errors.currentPassword = t('settings.validation.currentPasswordRequired');
    }

    if (!passwordData.newPassword) {
      errors.newPassword = t('settings.validation.newPasswordRequired');
    } else if (passwordData.newPassword.length < 6) {
      errors.newPassword = t('settings.validation.newPasswordMinLength');
    }

    if (!passwordData.confirmPassword) {
      errors.confirmPassword = t('settings.validation.confirmPasswordRequired');
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = t('settings.validation.passwordsDoNotMatch');
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      errors.newPassword = t('settings.validation.newPasswordSameAsCurrent');
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
    
    // Clear errors and success message
    if (profileErrors[name]) {
      setProfileErrors(prev => ({ ...prev, [name]: undefined }));
    }
    if (profileSuccess) setProfileSuccess('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    
    // Clear errors and success message
    if (passwordErrors[name]) {
      setPasswordErrors(prev => ({ ...prev, [name]: undefined }));
    }
    if (passwordSuccess) setPasswordSuccess('');
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateProfileForm()) return;

    setIsUpdatingProfile(true);
    setProfileSuccess('');
    
    try {
      const success = await updateProfile({
        name: profileData.name.trim(),
        email: profileData.email.trim()
      });
      
      if (success) {
        setProfileSuccess(t('settings.profile.successMessage'));
      }
    } catch (error) {
      setProfileErrors({ general: t('settings.profile.errorMessage') });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePasswordForm()) return;

    setIsChangingPassword(true);
    setPasswordSuccess('');
    
    try {
      const success = await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      if (success) {
        setPasswordSuccess(t('settings.password.successMessage'));
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (error) {
      setPasswordErrors({ general: t('settings.password.errorMessage') });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLanguageChange = async (language: string) => {
    if (language === currentLanguage) return;
    
    setIsUpdatingLanguage(true);
    setLanguageError('');
    setLanguageSuccess('');
    
    try {
      await changeLanguage(language);
      setLanguageSuccess(t('settings.language.successMessage'));
    } catch (error) {
      setLanguageError(t('settings.language.errorMessage'));
    } finally {
      setIsUpdatingLanguage(false);
    }
  };

  const handleLogout = () => {
    if (confirm(t('settings.logout.confirm'))) {
      logout();
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="mt-2 text-gray-600">
          {t('settings.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {t('settings.tabs.profile')}
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'password'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {t('settings.tabs.password')}
            </button>
            <button
              onClick={() => setActiveTab('language')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'language'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {t('settings.tabs.language')}
            </button>
          </nav>
          
          {/* Logout Button */}
          <div className="mt-6 pt-6 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="w-full text-red-600 border-red-200 hover:bg-red-50"
            >
              {t('navigation.logout')}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <Card className="p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">{t('settings.profile.title')}</h2>
                <p className="text-sm text-gray-600">{t('settings.profile.subtitle')}</p>
              </div>

              {profileSuccess && (
                <Alert variant="success" className="mb-4">
                  {profileSuccess}
                </Alert>
              )}

              {profileErrors.general && (
                <Alert variant="error" className="mb-4">
                  {profileErrors.general}
                </Alert>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    {t('settings.profile.nameLabel')}
                  </label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={profileData.name}
                    onChange={handleProfileChange}
                    error={profileErrors.name}
                    placeholder={t('settings.profile.namePlaceholder')}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    {t('settings.profile.emailLabel')}
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={profileData.email}
                    onChange={handleProfileChange}
                    error={profileErrors.email}
                    placeholder={t('settings.profile.emailPlaceholder')}
                    className="mt-1"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isUpdatingProfile}
                  >
                    {isUpdatingProfile ? (
                      <>
                        <LoadingStates.Spinner size="sm" className="mr-2" />
                        {t('settings.profile.updating')}
                      </>
                    ) : (
                      t('settings.profile.updateButton')
                    )}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <Card className="p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">{t('settings.password.title')}</h2>
                <p className="text-sm text-gray-600">{t('settings.password.subtitle')}</p>
              </div>

              {passwordSuccess && (
                <Alert variant="success" className="mb-4">
                  {passwordSuccess}
                </Alert>
              )}

              {passwordErrors.general && (
                <Alert variant="error" className="mb-4">
                  {passwordErrors.general}
                </Alert>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                    {t('settings.password.currentPasswordLabel')}
                  </label>
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    error={passwordErrors.currentPassword}
                    placeholder={t('settings.password.currentPasswordPlaceholder')}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                    {t('settings.password.newPasswordLabel')}
                  </label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    error={passwordErrors.newPassword}
                    placeholder={t('settings.password.newPasswordPlaceholder')}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    {t('settings.password.confirmPasswordLabel')}
                  </label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    error={passwordErrors.confirmPassword}
                    placeholder={t('settings.password.confirmPasswordPlaceholder')}
                    className="mt-1"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? (
                      <>
                        <LoadingStates.Spinner size="sm" className="mr-2" />
                        {t('settings.password.changing')}
                      </>
                    ) : (
                      t('settings.password.changeButton')
                    )}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Language Tab */}
          {activeTab === 'language' && (
            <Card className="p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">{t('settings.language.title')}</h2>
                <p className="text-sm text-gray-600">{t('settings.language.subtitle')}</p>
              </div>

              {languageSuccess && (
                <Alert variant="success" className="mb-4">
                  {languageSuccess}
                </Alert>
              )}

              {languageError && (
                <Alert variant="error" className="mb-4">
                  {languageError}
                </Alert>
              )}

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.language.currentLanguage')}
                  </label>
                  <div className="p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">
                        {currentLanguage === 'en' ? '🇺🇸' : '🇷🇺'}
                      </span>
                      <span className="font-medium">
                        {supportedLanguages.find(lang => lang.code === currentLanguage)?.nativeName}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.language.selectLanguage')}
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {supportedLanguages.map((language) => (
                      <button
                        key={language.code}
                        onClick={() => handleLanguageChange(language.code)}
                        disabled={isUpdatingLanguage || currentLanguage === language.code}
                        className={`p-4 border rounded-lg text-left transition-colors ${
                          currentLanguage === language.code
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        } ${isUpdatingLanguage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="text-2xl mr-3">
                              {language.code === 'en' ? '🇺🇸' : '🇷🇺'}
                            </span>
                            <div>
                              <div className="font-medium">{language.nativeName}</div>
                              <div className="text-sm text-gray-500">{language.name}</div>
                            </div>
                          </div>
                          {currentLanguage === language.code && (
                            <div className="text-blue-600">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {isUpdatingLanguage && (
                  <div className="flex items-center justify-center p-4">
                    <LoadingStates.Spinner size="sm" className="mr-2" />
                    <span className="text-sm text-gray-600">{t('settings.language.applying')}</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;