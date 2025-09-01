import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/Button';
import { 
  BriefcaseIcon, 
  ChartBarIcon, 
  ArrowUpOnSquareIcon, 
  HomeIcon 
} from '@heroicons/react/24/outline';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { label: 'Home', path: '/', icon: HomeIcon },
    { label: 'Upload CV', path: '/upload', icon: ArrowUpOnSquareIcon },
    { label: 'Dashboard', path: '/dashboard', icon: ChartBarIcon },
  ];

  return (
    <nav className="bg-gradient-to-r from-primary-500 to-secondary-500 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <BriefcaseIcon className="h-8 w-8 text-white mr-3" />
            <h1 className="text-xl font-semibold text-white">
              AI HR Interview System
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
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
        </div>
      </div>
    </nav>
  );
};

export default Navbar;