import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { Alert, AlertDescription } from '../components/ui/Alert';
import { useCreateJob } from '../hooks/useJobQueries';
import type { CreateJobRequest, FormErrors } from '../types';

const CreateJob: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createJobMutation = useCreateJob();
  
  const [formData, setFormData] = useState<CreateJobRequest>({
    title: '',
    description: '',
    requiredSkills: [],
    experience: {
      min: undefined,
      max: undefined
    }
  });

  const [skillsInput, setSkillsInput] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState('');

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = t('createJob.jobTitleRequired');
    }

    if (!formData.description.trim()) {
      newErrors.description = t('createJob.jobDescriptionRequired');
    }

    if (formData.requiredSkills.length === 0) {
      newErrors.requiredSkills = t('createJob.addSkillsError');
    }

    if (formData.experience?.min && formData.experience?.max) {
      if (Number(formData.experience.min) >= Number(formData.experience.max)) {
        newErrors.experience = t('createJob.minExperienceError');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof CreateJobRequest] as any,
          [child]: value || undefined
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
    if (success) setSuccess('');
  };

  const handleSkillsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSkillsInput(e.target.value);
  };

  const addSkill = () => {
    const skill = skillsInput.trim();
    if (skill && !formData.requiredSkills.includes(skill)) {
      setFormData(prev => ({
        ...prev,
        requiredSkills: [...prev.requiredSkills, skill]
      }));
      setSkillsInput('');
      
      // Clear errors
      if (errors.requiredSkills) {
        setErrors(prev => ({ ...prev, requiredSkills: undefined }));
      }
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      requiredSkills: prev.requiredSkills.filter(skill => skill !== skillToRemove)
    }));
  };

  const handleSkillKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    // Clean up the form data - remove empty optional fields
    const cleanFormData: CreateJobRequest = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      requiredSkills: formData.requiredSkills,
      ...(formData.experience?.min || formData.experience?.max ? {
        experience: {
          ...(formData.experience.min && { min: Number(formData.experience.min) }),
          ...(formData.experience.max && { max: Number(formData.experience.max) })
        }
      } : {})
    };

    try {
      const result = await createJobMutation.mutateAsync(cleanFormData);
      setSuccess(t('createJob.jobCreatedSuccess', { title: result.job.title }));
      
      // Redirect to job details after short delay
      setTimeout(() => {
        navigate(`/jobs/${result.job._id}`);
      }, 1500);
    } catch (error) {
      console.error('Failed to create job:', error);
      setErrors({ general: t('createJob.failedToCreateJob') });
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <button
          onClick={() => navigate('/jobs')}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-2 inline-block"
        >
          {t('createJob.backToJobs')}
        </button>
        <h1 className="text-3xl font-bold text-gray-900">{t('createJob.title')}</h1>
        <p className="mt-2 text-gray-600">
          {t('createJob.subtitle')}
        </p>
      </div>

      <Card className="p-6">
        {success && (
          <Alert variant="success" className="mb-6">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {errors.general && (
          <Alert variant="error" className="mb-6">
            <AlertDescription>{errors.general}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('createJob.basicInformation')}</h2>
            
            <Input
              label={t('createJob.jobTitle')}
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              error={errors.title}
              placeholder={t('createJob.jobTitlePlaceholder')}
              required
            />

            <Textarea
              label={t('createJob.jobDescription')}
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              error={errors.description}
              rows={6}
              placeholder={t('createJob.jobDescriptionPlaceholder')}
              required
            />
          </div>

          {/* Required Skills */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('createJob.requiredSkills')}</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('createJob.addSkills')} {errors.requiredSkills && <span className="text-red-500 text-sm">({errors.requiredSkills})</span>}
              </label>
              <div className="flex gap-2">
                <Input
                  value={skillsInput}
                  onChange={handleSkillsChange}
                  onKeyPress={handleSkillKeyPress}
                  placeholder={t('createJob.typeSkillPlaceholder')}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addSkill}
                  disabled={!skillsInput.trim()}
                >
                  {t('createJob.addButton')}
                </Button>
              </div>
            </div>

            {formData.requiredSkills.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-2">{t('createJob.requiredSkillsList')}</p>
                <div className="flex flex-wrap gap-2">
                  {formData.requiredSkills.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Experience Range */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('createJob.experienceRequirements')}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('createJob.minimumYears')}
                </label>
                <Input
                  type="number"
                  name="experience.min"
                  value={formData.experience?.min || ''}
                  onChange={handleInputChange}
                  placeholder="2"
                  className="mt-1"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('createJob.maximumYears')}
                </label>
                <Input
                  type="number"
                  name="experience.max"
                  value={formData.experience?.max || ''}
                  onChange={handleInputChange}
                  placeholder="5"
                  className="mt-1"
                  min="0"
                />
              </div>
            </div>
            {errors.experience && (
              <p className="text-red-500 text-sm">{errors.experience}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/jobs')}
            >
              {t('createJob.cancelButton')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createJobMutation.isPending}
            >
              {createJobMutation.isPending ? t('createJob.creatingJob') : t('createJob.createJobButton')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CreateJob;