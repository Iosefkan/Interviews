import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { 
  BriefcaseIcon, 
  ChartBarIcon, 
  Cog6ToothIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import vtbLogo from '../assets/vtb.svg';

const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const menuItems = [
    { label: t('navigation.home'), path: '/', icon: ChartBarIcon },
    { label: t('navigation.jobs'), path: '/jobs', icon: BriefcaseIcon },
  ];

  const handleLogout = () => {
    logout();
  };

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-blue-800 shadow-lg fixed w-full top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <div className="bg-white rounded-full p-2 mr-3">
              <img src={vtbLogo} alt="VTB Logo" className="h-8 w-8" />
            </div>
            <Link to="/" className="flex items-center">
              <h1 className="text-xl font-semibold text-white">
                {t('navigation.hrAiRecruitment')}
              </h1>
            </Link>
          </div>
          
          {/* Navigation Items */}
          <div className="flex items-center space-x-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = (item.path === '/' && (location.pathname === '/' || location.pathname === '/home' || location.pathname === '/dashboard')) ||
                (item.path !== '/' && location.pathname === item.path) || 
                (item.path !== '/' && item.path !== '/dashboard' && location.pathname.startsWith(item.path));
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`
                    flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200
                    ${
                      isActive
                        ? 'bg-white bg-opacity-20 text-white border border-white border-opacity-30'
                        : 'text-white hover:bg-white hover:bg-opacity-10'
                    }
                  `}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-white">
              <UserIcon className="h-5 w-5" />
              <span className="text-sm font-medium">{user?.name}</span>
            </div>
            
            <Link to="/settings">
              <button className="text-white hover:bg-white hover:bg-opacity-10 p-2 rounded-lg transition-colors">
                <Cog6ToothIcon className="h-5 w-5" />
              </button>
            </Link>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-white text-blue-600 hover:bg-white hover:text-blue-800"
            >
              {t('navigation.logout')}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;