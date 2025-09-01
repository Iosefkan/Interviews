import puppeteer from 'puppeteer';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

class ReportService {
  async generateInterviewReport(interviewSession, candidate) {
    try {
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      
      // Generate the HTML content for the report
      const htmlContent = this.generateReportHTML(interviewSession, candidate);
      
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // Generate PDF
      const fileName = `interview-report-${candidate._id}-${Date.now()}.pdf`;
      const filePath = join(process.cwd(), 'reports', fileName);
      
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      await browser.close();

      return {
        filePath,
        fileName,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Report generation error:', error);
      throw new Error(`Failed to generate report: ${error.message}`);
    }
  }

  generateReportHTML(session, candidate) {
    const formatDate = (date) => new Date(date).toLocaleDateString();
    const formatDuration = (seconds) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Interview Report - ${candidate.personalInfo.name}</title>
        <style>
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                margin: 0;
                padding: 0;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            .section {
                margin-bottom: 30px;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                overflow: hidden;
            }
            .section-header {
                background-color: #f5f5f5;
                padding: 15px 20px;
                font-weight: bold;
                border-bottom: 1px solid #e0e0e0;
            }
            .section-content {
                padding: 20px;
            }
            .candidate-info {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
            }
            .score-box {
                text-align: center;
                padding: 20px;
                border-radius: 8px;
                margin: 10px 0;
            }
            .score-excellent { background-color: #d4edda; border: 1px solid #c3e6cb; }
            .score-good { background-color: #fff3cd; border: 1px solid #ffeaa7; }
            .score-average { background-color: #f8d7da; border: 1px solid #f5c6cb; }
            .skill-item {
                padding: 8px 12px;
                margin: 5px;
                border-radius: 20px;
                display: inline-block;
                font-size: 0.9em;
            }
            .skill-verified { background-color: #d4edda; color: #155724; }
            .skill-claimed { background-color: #fff3cd; color: #856404; }
            .skill-not-verified { background-color: #f8d7da; color: #721c24; }
            .transcript {
                max-height: 400px;
                overflow-y: auto;
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
            }
            .message {
                margin-bottom: 15px;
                padding: 10px;
                border-radius: 5px;
            }
            .ai-message {
                background-color: #e3f2fd;
                border-left: 4px solid #2196f3;
            }
            .candidate-message {
                background-color: #f3e5f5;
                border-left: 4px solid #9c27b0;
            }
            .footer {
                text-align: center;
                color: #666;
                font-size: 0.9em;
                margin-top: 30px;
                padding: 20px;
                border-top: 1px solid #e0e0e0;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Interview Assessment Report</h1>
            <p>Generated on ${formatDate(new Date())}</p>
        </div>

        <div class="container">
            <!-- Candidate Information -->
            <div class="section">
                <div class="section-header">Candidate Information</div>
                <div class="section-content">
                    <div class="candidate-info">
                        <div>
                            <strong>Name:</strong> ${candidate.personalInfo.name}<br>
                            <strong>Email:</strong> ${candidate.personalInfo.email}<br>
                            ${candidate.personalInfo.phone ? `<strong>Phone:</strong> ${candidate.personalInfo.phone}<br>` : ''}
                            <strong>Position:</strong> ${candidate.jobInfo.title}
                        </div>
                        <div>
                            <strong>Interview Date:</strong> ${formatDate(session.startTime)}<br>
                            <strong>Duration:</strong> ${session.duration ? formatDuration(session.duration) : 'N/A'}<br>
                            <strong>Type:</strong> ${session.sessionType}<br>
                            <strong>Status:</strong> ${session.status}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Overall Assessment -->
            <div class="section">
                <div class="section-header">Overall Assessment</div>
                <div class="section-content">
                    <div class="score-box ${session.evaluation?.overallScore >= 80 ? 'score-excellent' : 
                                          session.evaluation?.overallScore >= 60 ? 'score-good' : 'score-average'}">
                        <h2>Overall Score: ${session.evaluation?.overallScore || 0}/100</h2>
                        <p>Communication Score: ${session.evaluation?.communicationScore || 0}/10</p>
                        <p>Confidence Level: ${session.evaluation?.confidence || 0}/10</p>
                    </div>
                </div>
            </div>

            <!-- Skills Assessment -->
            <div class="section">
                <div class="section-header">Skills Assessment</div>
                <div class="section-content">
                    <h4>CV Skills Analysis:</h4>
                    ${candidate.analysis?.extractedData?.skills?.map(skill => 
                        `<span class="skill-item skill-claimed">${skill}</span>`
                    ).join('') || '<p>No skills data available</p>'}
                    
                    ${session.evaluation?.skillsVerified?.length > 0 ? `
                    <h4>Interview Verification:</h4>
                    ${session.evaluation.skillsVerified.map(skill => `
                        <div style="margin: 10px 0;">
                            <span class="skill-item ${skill.verified ? 'skill-verified' : 'skill-not-verified'}">
                                ${skill.skill} (Score: ${skill.score}/10)
                            </span>
                            ${skill.evidence ? `<p style="font-size: 0.9em; color: #666; margin: 5px 0;">${skill.evidence}</p>` : ''}
                        </div>
                    `).join('')}
                    ` : ''}
                </div>
            </div>

            <!-- Strengths and Weaknesses -->
            ${session.evaluation?.strengths?.length > 0 || session.evaluation?.weaknesses?.length > 0 ? `
            <div class="section">
                <div class="section-header">Strengths & Areas for Improvement</div>
                <div class="section-content">
                    ${session.evaluation.strengths?.length > 0 ? `
                    <h4>Strengths:</h4>
                    <ul>
                        ${session.evaluation.strengths.map(strength => `<li>${strength}</li>`).join('')}
                    </ul>
                    ` : ''}
                    
                    ${session.evaluation.weaknesses?.length > 0 ? `
                    <h4>Areas for Improvement:</h4>
                    <ul>
                        ${session.evaluation.weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
                    </ul>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            <!-- Recommendations -->
            ${session.evaluation?.recommendations ? `
            <div class="section">
                <div class="section-header">Recommendations</div>
                <div class="section-content">
                    <p>${session.evaluation.recommendations}</p>
                </div>
            </div>
            ` : ''}

            <!-- Interview Transcript -->
            <div class="section">
                <div class="section-header">Interview Transcript</div>
                <div class="section-content">
                    <div class="transcript">
                        ${session.transcript?.map(message => `
                            <div class="message ${message.speaker === 'ai' ? 'ai-message' : 'candidate-message'}">
                                <strong>${message.speaker === 'ai' ? 'Interviewer' : 'Candidate'}:</strong>
                                <p>${message.content}</p>
                                <small>${formatDate(message.timestamp)}</small>
                            </div>
                        `).join('') || '<p>No transcript available</p>'}
                    </div>
                </div>
            </div>

            <!-- AI Notes -->
            ${session.evaluation?.aiNotes ? `
            <div class="section">
                <div class="section-header">AI Analysis Notes</div>
                <div class="section-content">
                    <p>${session.evaluation.aiNotes}</p>
                </div>
            </div>
            ` : ''}
        </div>

        <div class="footer">
            <p>This report was generated automatically by the AI CV Screening and Interview System</p>
            <p>Report ID: ${session._id}</p>
        </div>
    </body>
    </html>
    `;
  }

  async generateCVAnalysisReport(candidate) {
    // Similar to interview report but focused on CV analysis
    try {
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      const htmlContent = this.generateCVReportHTML(candidate);
      
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const fileName = `cv-analysis-${candidate._id}-${Date.now()}.pdf`;
      const filePath = join(process.cwd(), 'reports', fileName);
      
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      await browser.close();

      return { filePath, fileName, generatedAt: new Date() };
    } catch (error) {
      console.error('CV report generation error:', error);
      throw new Error(`Failed to generate CV report: ${error.message}`);
    }
  }

  generateCVReportHTML(candidate) {
    const formatDate = (date) => new Date(date).toLocaleDateString();

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>CV Analysis Report - ${candidate.personalInfo.name}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background: #667eea; color: white; padding: 30px; text-align: center; }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; }
            .section { margin-bottom: 30px; border: 1px solid #e0e0e0; border-radius: 8px; }
            .section-header { background-color: #f5f5f5; padding: 15px 20px; font-weight: bold; }
            .section-content { padding: 20px; }
            .score-box { text-align: center; padding: 20px; border-radius: 8px; margin: 10px 0; }
            .qualified { background-color: #d4edda; border: 1px solid #c3e6cb; }
            .not-qualified { background-color: #f8d7da; border: 1px solid #f5c6cb; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>CV Analysis Report</h1>
            <p>Generated on ${formatDate(new Date())}</p>
        </div>
        <div class="container">
            <div class="section">
                <div class="section-header">Candidate Information</div>
                <div class="section-content">
                    <p><strong>Name:</strong> ${candidate.personalInfo.name}</p>
                    <p><strong>Email:</strong> ${candidate.personalInfo.email}</p>
                    <p><strong>Position Applied:</strong> ${candidate.jobInfo.title}</p>
                </div>
            </div>
            
            <div class="section">
                <div class="section-header">Qualification Assessment</div>
                <div class="section-content">
                    <div class="score-box ${candidate.analysis.qualified ? 'qualified' : 'not-qualified'}">
                        <h2>${candidate.analysis.qualified ? 'QUALIFIED' : 'NOT QUALIFIED'}</h2>
                        <p>Score: ${candidate.analysis.qualificationScore}/100</p>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-header">AI Analysis Notes</div>
                <div class="section-content">
                    <p>${candidate.analysis.aiNotes}</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
  }
}

export default new ReportService();