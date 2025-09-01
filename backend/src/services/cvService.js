import pdf from 'pdf-parse';
import fs from 'fs/promises';

class CVService {
  // Enhanced language detection method with better accuracy
  detectLanguage(cvText) {
    // Use a larger sample for better accuracy but limit for performance
    const sampleText = cvText.length > 50000 ? cvText.substring(0, 50000) : cvText;
    
    // Russian characters (including uppercase)
    const russianChars = new Set('абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ');
    // English characters (including uppercase)
    const englishChars = new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
    
    let rusCount = 0;
    let engCount = 0;
    let totalChars = 0;
    
    // Count characters from each language
    for (const char of sampleText) {
      if (russianChars.has(char)) {
        rusCount++;
        totalChars++;
      } else if (englishChars.has(char)) {
        engCount++;
        totalChars++;
      }
    }
    
    // Need at least some characters to make a determination
    if (totalChars === 0) {
      return 'ru'; // Default to Russian if no characters found
    }
    
    // Calculate percentages
    const rusPercentage = (rusCount / totalChars) * 100;
    const engPercentage = (engCount / totalChars) * 100;
    
    // Log for debugging
    console.log(`Language detection: Russian ${rusPercentage.toFixed(1)}%, English ${engPercentage.toFixed(1)}%`);
    
    // Determine language based on character frequency with threshold
    // At least 5% of characters should be from one language to make a determination
    if (rusPercentage >= 5 && rusPercentage > engPercentage) {
      return 'ru';
    } else if (engPercentage >= 5 && engPercentage > rusPercentage) {
      return 'en';
    }
    
    // Default to Russian if no clear preference
    return 'ru';
  }

  async extractTextFromPdf(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const data = await pdf(buffer);
      
      // Clean and format the extracted text
      const cleanText = data.text
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
        .trim();
        
      // Detect language from CV text
      const detectedLanguage = this.detectLanguage(cleanText);

      return {
        text: cleanText,
        pages: data.numpages,
        info: data.info,
        language: detectedLanguage
      };
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  async extractPersonalInfo(cvText) {
    // Basic regex patterns for extracting personal information
    const patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g
    };

    const extractedInfo = {};

    // Extract email
    const emailMatch = cvText.match(patterns.email);
    if (emailMatch) {
      extractedInfo.email = emailMatch[0];
    }

    // Extract phone
    const phoneMatch = cvText.match(patterns.phone);
    if (phoneMatch) {
      extractedInfo.phone = phoneMatch[0];
    }

    // Enhanced name extraction with multiple patterns
    const namePattern = this.extractNameFromCV(cvText);
    if (namePattern) {
      extractedInfo.name = namePattern;
    }

    // Detect language and add to personal info
    const detectedLanguage = this.detectLanguage(cvText);
    extractedInfo.preferredLanguage = detectedLanguage;

    return extractedInfo;
  }

  extractNameFromCV(cvText) {
    const lines = cvText.split('\n').filter(line => line.trim().length > 0);
    
    // Enhanced name patterns
    const namePatterns = [
      // Standard name patterns (John Smith, Mary Johnson)
      /^([A-Z][a-z]+ [A-Z][a-z]+)$/,
      // Names with middle initials (John A. Smith)
      /^([A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+)$/,
      // Names with titles (Dr. John Smith, Mr. John Smith)
      /^(?:Dr\.|Mr\.|Ms\.|Mrs\.|Prof\.) ([A-Z][a-z]+ [A-Z][a-z]+)$/,
      // All caps names (JOHN SMITH)
      /^([A-Z]+ [A-Z]+)$/,
      // Mixed case names (John SMITH, JOHN Smith)
      /^([A-Z][a-z]+ [A-Z]+)$|^([A-Z]+ [A-Z][a-z]+)$/,
      // Names with hyphens (Mary-Jane Smith, Jean-Paul Doe)
      /^([A-Z][a-z-]+ [A-Z][a-z]+)$/,
      // Names with suffixes (John Smith Jr., Mary Johnson III)
      /^([A-Z][a-z]+ [A-Z][a-z]+ (?:Jr\.|Sr\.|III|IV|II))$/,
      // Three-part names (John Michael Smith)
      /^([A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+)$/,
      // Names with accented characters (José María, François Müller)
      /^([A-ZÀ-ÿ][a-zà-ÿ]+ [A-ZÀ-ÿ][a-zà-ÿ]+)$/,
      // Single names followed by surname (John DAVIDSON)
      /^([A-Z][a-z]+ [A-Z]{2,})$/
    ];

    // Check first 10 lines for name patterns
    for (const line of lines.slice(0, 10)) {
      const trimmedLine = line.trim();
      
      // Skip lines that are too short or too long
      if (trimmedLine.length < 3 || trimmedLine.length > 60) continue;
      
      // Skip lines that contain common CV keywords
      const skipKeywords = ['email', 'phone', 'address', 'cv', 'resume', 'profile', 'objective', 'experience', 'education', 'skills', 'www', 'http', '@'];
      if (skipKeywords.some(keyword => trimmedLine.toLowerCase().includes(keyword))) continue;
      
      // Test against name patterns
      for (const pattern of namePatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          // Extract the captured group (name without title/suffix if applicable)
          const name = match[1] || match[2] || match[0];
          
          // Additional validation - ensure it's not a common false positive
          if (this.isValidName(name)) {
            return this.formatName(name);
          }
        }
      }
    }
    
    return null;
  }

  isValidName(name) {
    // Additional validation to filter out false positives
    const invalidWords = ['curriculum', 'vitae', 'personal', 'information', 'contact', 'details', 'summary', 'overview'];
    const nameLower = name.toLowerCase();
    
    // Check if name contains invalid words
    if (invalidWords.some(word => nameLower.includes(word))) {
      return false;
    }
    
    // Must contain at least one space (first name + last name)
    if (!name.includes(' ')) {
      return false;
    }
    
    // Must not be all numbers or contain too many numbers
    const numberCount = (name.match(/\d/g) || []).length;
    if (numberCount > 2) {
      return false;
    }
    
    return true;
  }

  formatName(name) {
    // Clean up and format the name
    return name
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim()
      .split(' ')
      .map(word => {
        // Handle all caps words
        if (word === word.toUpperCase() && word.length > 1) {
          return word.charAt(0) + word.slice(1).toLowerCase();
        }
        return word;
      })
      .join(' ');
  }

  parseAnalysisResult(aiResponse) {
    // Validate and format the AI analysis response
    const requiredFields = ['qualified', 'qualificationScore', 'extractedData', 'aiNotes'];
    
    for (const field of requiredFields) {
      if (!(field in aiResponse)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Ensure qualification score is within valid range and is not a placeholder
    aiResponse.qualificationScore = Math.max(0, Math.min(100, aiResponse.qualificationScore));
    
    // Additional validation to ensure score is realistic (not a placeholder)
    // If score seems like a placeholder (e.g., exactly 85), we should re-evaluate
    if (aiResponse.qualificationScore === 85) {
      console.warn('Warning: AI returned a potential placeholder score of 85. Verify this is a legitimate score.');
    }

    // Ensure extractedData has required structure
    if (!aiResponse.extractedData.skills) {
      aiResponse.extractedData.skills = [];
    }
    if (!aiResponse.extractedData.technologies) {
      aiResponse.extractedData.technologies = [];
    }
    if (!aiResponse.extractedData.experience) {
      aiResponse.extractedData.experience = {
        totalYears: 0,
        positions: [],
        education: []
      };
    }

    // Ensure matchingCriteria exists
    if (!aiResponse.matchingCriteria) {
      aiResponse.matchingCriteria = [];
    }

    return aiResponse;
  }

  async validateCVFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      
      // Check file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (stats.size > maxSize) {
        throw new Error('File size exceeds maximum limit (10MB)');
      }

      // Try to extract text to validate it's a readable PDF
      await this.extractTextFromPdf(filePath);
      
      return true;
    } catch (error) {
      throw new Error(`Invalid CV file: ${error.message}`);
    }
  }
}

export default new CVService();