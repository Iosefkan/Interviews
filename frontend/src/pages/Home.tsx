import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import {
  ArrowUpOnSquareIcon,
  CpuChipIcon,
  ChartBarIcon,
  DocumentIcon,
  CheckCircleIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

const Home: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: ArrowUpOnSquareIcon,
      title: 'CV Upload & Analysis',
      description: 'Upload candidate CVs and get AI-powered qualification assessment',
    },
    {
      icon: CpuChipIcon,
      title: 'AI Interviews',
      description: 'Conduct interactive interviews with voice-to-voice AI communication',
    },
    {
      icon: ChartBarIcon,
      title: 'Skills Verification',
      description: 'Verify technical and soft skills through dynamic questioning',
    },
    {
      icon: DocumentIcon,
      title: 'PDF Reports',
      description: 'Generate comprehensive interview reports with detailed assessments',
    },
  ];

  const benefits = [
    'AI-powered CV qualification assessment',
    'Real-time voice-to-voice interviews',
    'Skills verification and evaluation',
    'Automated report generation',
    'Comprehensive candidate scoring',
    'Streamlined recruitment process',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center py-16">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
          AI CV Screening & Interview System
        </h1>
        <h2 className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto">
          Revolutionize your recruitment process with AI-powered CV analysis and interactive interviews
        </h2>
        <div className="flex gap-4 justify-center flex-wrap">
          <Button
            size="lg"
            onClick={() => navigate('/upload')}
            className="px-8 py-3 text-lg"
          >
            <ArrowUpOnSquareIcon className="mr-2 h-5 w-5" />
            Upload CV
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3 text-lg"
          >
            <ChartBarIcon className="mr-2 h-5 w-5" />
            View Dashboard
          </Button>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
          Key Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="h-full transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg">
                <CardContent>
                  <div className="flex items-center mb-4">
                    <Icon className="h-8 w-8 text-primary-500 mr-3" />
                    <h3 className="text-xl font-semibold text-gray-900">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Benefits Section */}
      <div className="py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Why Choose Our System?
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Our AI-powered recruitment system streamlines the entire hiring process from CV screening 
              to final interview assessment, saving you time and ensuring consistent, unbiased evaluations.
            </p>
            <ul className="space-y-4">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircleIcon className="h-6 w-6 text-primary-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Card className="p-8 text-center bg-gradient-to-br from-gray-50 to-gray-100">
              <CpuChipIcon className="h-20 w-20 text-primary-500 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Powered by Advanced AI
              </h3>
              <p className="text-gray-600 mb-8">
                Utilizing OpenRouter AI models, XTTSv2 for speech synthesis, and OpenAI Whisper for 
                speech recognition to deliver the most accurate and natural interview experience.
              </p>
              <div className="flex justify-around">
                <div className="text-center">
                  <BoltIcon className="h-10 w-10 text-primary-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-700">Fast Processing</p>
                </div>
                <div className="text-center">
                  <ChartBarIcon className="h-10 w-10 text-primary-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-700">Accurate Assessment</p>
                </div>
                <div className="text-center">
                  <CpuChipIcon className="h-10 w-10 text-primary-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-700">AI Intelligence</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16 text-center bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-2xl my-16">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Ready to Transform Your Recruitment?
        </h2>
        <p className="text-xl mb-8 opacity-90">
          Start screening candidates with AI-powered interviews today
        </p>
        <Button
          size="lg"
          onClick={() => navigate('/upload')}
          className="bg-white text-primary-500 hover:bg-gray-100 px-8 py-3 text-lg"
        >
          Get Started Now
        </Button>
      </div>
    </div>
  );
};

export default Home;