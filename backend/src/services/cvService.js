import pdf from 'pdf-parse';
import fs from 'fs/promises';

class CVService {
  async extractTextFromPdf(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const data = await pdf(buffer);
      
      // Clean and format the extracted text
      const cleanText = data.text
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
        .trim();

      return {
        text: cleanText,
        pages: data.numpages,
        info: data.info
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
      phone: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
      name: /^([A-Z][a-z]+ [A-Z][a-z]+)/m // Simple name extraction from first line
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

    // Extract name (this is a simple approach, might need refinement)
    const lines = cvText.split('\n').filter(line => line.trim().length > 0);
    for (const line of lines.slice(0, 5)) { // Check first 5 lines
      if (line.trim().length > 0 && 
          line.trim().length < 50 && 
          /^[A-Z][a-z]+ [A-Z][a-z]+/.test(line.trim())) {
        extractedInfo.name = line.trim();
        break;
      }
    }

    return extractedInfo;
  }

  parseAnalysisResult(aiResponse) {
    // Validate and format the AI analysis response
    const requiredFields = ['qualified', 'qualificationScore', 'extractedData', 'aiNotes'];
    
    for (const field of requiredFields) {
      if (!(field in aiResponse)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Ensure qualification score is within valid range
    aiResponse.qualificationScore = Math.max(0, Math.min(100, aiResponse.qualificationScore));

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