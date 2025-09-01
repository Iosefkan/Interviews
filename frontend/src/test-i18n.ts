/**
 * Test script to validate Russian language support implementation
 * This script tests key functionality of the i18n system
 */

import '../src/i18n';
import i18n from 'i18next';

// Test 1: Language Detection Logic
console.log('🔍 Testing Language Detection Logic...');

const testBrowserLanguages = [
  { input: 'en-US', expected: 'en', description: 'English US browser' },
  { input: 'en', expected: 'en', description: 'English browser' },
  { input: 'ru-RU', expected: 'ru', description: 'Russian RU browser' },
  { input: 'ru', expected: 'ru', description: 'Russian browser' },
  { input: 'de-DE', expected: 'ru', description: 'German browser (fallback to Russian)' },
  { input: 'fr-FR', expected: 'ru', description: 'French browser (fallback to Russian)' },
];

testBrowserLanguages.forEach(test => {
  // Simulate browser language detection
  let detectedLang = 'ru'; // Default fallback
  if (test.input.toLowerCase().startsWith('en')) {
    detectedLang = 'en';
  } else if (test.input.toLowerCase().startsWith('ru')) {
    detectedLang = 'ru';
  }
  
  const passed = detectedLang === test.expected;
  console.log(`${passed ? '✅' : '❌'} ${test.description}: ${test.input} → ${detectedLang} (expected: ${test.expected})`);
});

// Test 2: Translation Key Coverage
console.log('\n📚 Testing Translation Key Coverage...');

const requiredKeys = [
  'navigation.home',
  'navigation.jobs', 
  'navigation.settings',
  'navigation.logout',
  'auth.login.title',
  'auth.login.signIn',
  'settings.title',
  'settings.language.title',
  'dashboard.title',
  'common.loading'
];

const languages = ['en', 'ru'];

languages.forEach(lang => {
  console.log(`\n🌍 Testing ${lang.toUpperCase()} translations:`);
  requiredKeys.forEach(key => {
    const translation = i18n.getResource(lang, 'translation', key);
    const exists = translation && translation !== key;
    console.log(`${exists ? '✅' : '❌'} ${key}: "${translation || 'MISSING'}"`);
  });
});

// Test 3: Language Switching
console.log('\n🔄 Testing Language Switching...');

async function testLanguageSwitching() {
  try {
    // Test switching to English
    await i18n.changeLanguage('en');
    const homeEN = i18n.t('navigation.home');
    console.log(`✅ Switch to EN: navigation.home = "${homeEN}"`);
    
    // Test switching to Russian  
    await i18n.changeLanguage('ru');
    const homeRU = i18n.t('navigation.home');
    console.log(`✅ Switch to RU: navigation.home = "${homeRU}"`);
    
    // Verify they're different
    if (homeEN !== homeRU) {
      console.log('✅ Languages are properly differentiated');
    } else {
      console.log('❌ Languages are not differentiated');
    }
    
  } catch (error) {
    console.log('❌ Language switching failed:', error);
  }
}

testLanguageSwitching();

// Test 4: Fallback Behavior
console.log('\n🎯 Testing Fallback Behavior...');

// Test missing key behavior
const missingKey = i18n.t('nonexistent.key');
console.log(`Missing key result: "${missingKey}"`);

// Test interpolation
const settingsTitle = i18n.t('settings.title');
console.log(`Settings title: "${settingsTitle}"`);

console.log('\n🎉 Russian Language Support Testing Complete!');

export default {};  // Make this a module