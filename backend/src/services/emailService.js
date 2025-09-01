import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  async initializeTransporter() {
    try {
      // Check if required environment variables are present
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.warn('⚠️  Email service not configured: EMAIL_USER and EMAIL_PASSWORD environment variables are required');
        this.transporter = null;
        this.initialized = false;
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      // Verify connection configuration
      await this.transporter.verify();
      console.log('✅ Email service initialized successfully');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
      this.transporter = null;
      this.initialized = false;
    }
  }

  // Generate unique session key for interview
  generateSessionKey() {
    return `INT_${uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase()}`;
  }

  // Create interview link without session key
  createInterviewLink(sessionKey) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return `${baseUrl}/interview/start`;
  }

  // Generate HTML email template for interview invitation
  generateInvitationEmailHtml(candidateData, interviewData, language = 'en') {
    const { personalInfo, jobInfo } = candidateData;
    const { sessionKey, expiresAt, interviewLink } = interviewData;
    
    // Format date based on language
    let expirationDate;
    if (language === 'ru') {
      expirationDate = new Date(expiresAt).toLocaleDateString('ru-RU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      expirationDate = new Date(expiresAt).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // Use Russian template if language is Russian, otherwise use English
    if (language === 'ru') {
      return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset=\"utf-8\">
          <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
          <title>Приглашение на интервью</title>
          <style>
              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
              }
              .header {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 30px;
                  text-align: center;
                  border-radius: 10px 10px 0 0;
              }
              .content {
                  background: #f8f9fa;
                  padding: 30px;
                  border-radius: 0 0 10px 10px;
              }
              .highlight-box {
                  background: #e3f2fd;
                  border-left: 4px solid #2196f3;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 0 5px 5px 0;
              }
              .cta-button {
                  display: inline-block;
                  background: #4caf50;
                  color: white;
                  padding: 15px 30px;
                  text-decoration: none;
                  border-radius: 5px;
                  font-weight: bold;
                  margin: 20px 0;
                  text-align: center;
              }
              .session-key {
                  background: #fff3cd;
                  border: 2px dashed #ffc107;
                  padding: 15px;
                  text-align: center;
                  font-family: monospace;
                  font-size: 18px;
                  font-weight: bold;
                  color: #856404;
                  margin: 20px 0;
                  border-radius: 5px;
              }
              .warning {
                  background: #fff3cd;
                  border-left: 4px solid #ffc107;
                  padding: 15px;
                  margin: 20px 0;
                  color: #856404;
                  border-radius: 0 5px 5px 0;
              }
              .footer {
                  margin-top: 30px;
                  padding-top: 20px;
                  border-top: 1px solid #ddd;
                  color: #666;
                  font-size: 14px;
                  text-align: center;
              }
          </style>
      </head>
      <body>
          <div class=\"header\">
              <h1>🎉 Поздравляем!</h1>
              <h2>Вы приглашены на интервью</h2>
          </div>
          
          <div class=\"content\">
              <p>Уважаемый(ая) <strong>${personalInfo.name}</strong>,</p>
              
              <p>Мы рады сообщить, что ваше резюме на позицию <strong>${jobInfo.title}</strong> было рассмотрено и вы успешно прошли наш первоначальный отбор!</p>
              
              <div class=\"highlight-box\">
                  <h3>🚀 Следующий шаг: Интервью</h3>
                  <p>Мы хотели бы пригласить вас принять участие в нашем инновационном процессе интервью. Это интервью предназначено для оценки ваших технических навыков, опыта и соответствия корпоративной культуре нашей организации.</p>
              </div>
              
              <h3>📋 Детали интервью:</h3>
              <ul>
                  <li><strong>Позиция:</strong> ${jobInfo.title}</li>
                  <li><strong>Тип интервью:</strong> Техническое и поведенческое интервью</li>
                  <li><strong>Продолжительность:</strong> Примерно 30-45 минут</li>
                  <li><strong>Формат:</strong> Голосовая беседа с AI-интервьюером</li>
                  <li><strong>Крайний срок:</strong> ${expirationDate}</li>
              </ul>
              
              <div class=\"warning\">
                  <strong>⏰ Важно:</strong> У вас есть <strong>одна неделя</strong> с сегодняшнего дня, чтобы завершить интервью. Интервью можно пройти в любое удобное для вас время, но убедитесь, что вы завершите его до крайнего срока.
              </div>
              
              <h3>🔑 Ваша информация для доступа к интервью:</h3>
              
              <div class=\"session-key\">
                  Ключ сессии: ${sessionKey}
              </div>
              
              <p>Чтобы начать интервью, выполните следующие шаги:</p>
              <ol>
                  <li>Нажмите кнопку ниже, чтобы получить доступ к платформе интервью</li>
                  <li>Введите ваш ключ сессии при появлении запроса</li>
                  <li>Убедитесь, что у вас тихая обстановка и работающий микрофон</li>
                  <li>Следуйте инструкциям AI-интервьюера</li>
              </ol>
              
              <div style=\"text-align: center; margin: 30px 0;\">
                  <a href=\"${interviewLink}\" class=\"cta-button\">🎯 Начать интервью сейчас</a>
              </div>
              
              <p><strong>Альтернативный доступ:</strong> Если кнопка не работает, вы можете скопировать и вставить эту ссылку в браузер:</p>
              <p style=\"word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px; font-family: monospace;\">${interviewLink}</p>
              
              <h3>💡 Советы для интервью:</h3>
              <ul>
                  <li>Найдите тихое место с минимальными отвлекающими факторами</li>
                  <li>Проверьте микрофон и динамики заранее</li>
                  <li>Говорите четко и в умеренном темпе</li>
                  <li>Будьте честны в описании своего опыта и навыков</li>
                  <li>Потратьте время на обдумывание ответов</li>
                  <li>AI задаст дополнительные вопросы на основе ваших ответов</li>
              </ul>
              
              <div class=\"highlight-box\">
                  <h4>🎤 Технические требования:</h4>
                  <p>Убедитесь, что у вас есть:</p>
                  <ul>
                      <li>Работающий микрофон</li>
                      <li>Стабильное интернет-соединение</li>
                      <li>Современный веб-браузер (Chrome, Firefox, Safari или Edge)</li>
                      <li>Примерно 45 минут непрерывного времени</li>
                  </ul>
              </div>
              
              <p>Если вы столкнетесь с техническими проблемами во время интервью, пожалуйста, не стесняйтесь обращаться к нашей HR-команде за помощью.</p>
              
              <p>Мы с нетерпением ждем возможности узнать больше о вас и вашем опыте. Удачи!</p>
              
              <p>С наилучшими пожеланиями,<br>
              <strong>HR Команда</strong><br>
              Отдел подбора персонала</p>
          </div>
          
          <div class=\"footer\">
              <p>Это приглашение на интервью истекает ${expirationDate}</p>
              <p>Пожалуйста, не отвечайте на это автоматическое письмо. По техническим вопросам обращайтесь к нашей HR-команде.</p>
          </div>
      </body>
      </html>
      `;
    } else {
      // English template (existing code)
      return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset=\"utf-8\">
          <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
          <title>Interview Invitation</title>
          <style>
              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
              }
              .header {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 30px;
                  text-align: center;
                  border-radius: 10px 10px 0 0;
              }
              .content {
                  background: #f8f9fa;
                  padding: 30px;
                  border-radius: 0 0 10px 10px;
              }
              .highlight-box {
                  background: #e3f2fd;
                  border-left: 4px solid #2196f3;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 0 5px 5px 0;
              }
              .cta-button {
                  display: inline-block;
                  background: #4caf50;
                  color: white;
                  padding: 15px 30px;
                  text-decoration: none;
                  border-radius: 5px;
                  font-weight: bold;
                  margin: 20px 0;
                  text-align: center;
              }
              .session-key {
                  background: #fff3cd;
                  border: 2px dashed #ffc107;
                  padding: 15px;
                  text-align: center;
                  font-family: monospace;
                  font-size: 18px;
                  font-weight: bold;
                  color: #856404;
                  margin: 20px 0;
                  border-radius: 5px;
              }
              .warning {
                  background: #fff3cd;
                  border-left: 4px solid #ffc107;
                  padding: 15px;
                  margin: 20px 0;
                  color: #856404;
                  border-radius: 0 5px 5px 0;
              }
              .footer {
                  margin-top: 30px;
                  padding-top: 20px;
                  border-top: 1px solid #ddd;
                  color: #666;
                  font-size: 14px;
                  text-align: center;
              }
          </style>
      </head>
      <body>
          <div class=\"header\">
              <h1>🎉 Congratulations!</h1>
              <h2>You've been selected for an Interview</h2>
          </div>
          
          <div class=\"content\">
              <p>Dear <strong>${personalInfo.name}</strong>,</p>
              
              <p>We are excited to inform you that your CV for the position of <strong>${jobInfo.title}</strong> has been reviewed and you have successfully passed our initial screening process!</p>
              
              <div class=\"highlight-box\">
                  <h3>🚀 Next Step: Interview</h3>
                  <p>We would like to invite you to participate in our innovative interview process. This interview is designed to assess your technical skills, experience, and cultural fit for our organization.</p>
              </div>
              
              <h3>📋 Interview Details:</h3>
              <ul>
                  <li><strong>Position:</strong> ${jobInfo.title}</li>
                  <li><strong>Interview Type:</strong> Technical & Behavioral Interview</li>
                  <li><strong>Duration:</strong> Approximately 30-45 minutes</li>
                  <li><strong>Format:</strong> Voice-based conversation with AI interviewer</li>
                  <li><strong>Deadline:</strong> ${expirationDate}</li>
              </ul>
              
              <div class=\"warning\">
                  <strong>⏰ Important:</strong> You have <strong>one week</strong> from today to complete the interview. The interview can be taken at any time that's convenient for you, but please ensure you complete it before the deadline.
              </div>
              
              <h3>🔑 Your Interview Access Information:</h3>
              
              <div class=\"session-key\">
                  Session Key: ${sessionKey}
              </div>
              
              <p>To start your interview, please follow these steps:</p>
              <ol>
                  <li>Click the button below to access the interview platform</li>
                  <li>Enter your session key when prompted</li>
                  <li>Ensure you have a quiet environment and working microphone</li>
                  <li>Follow the AI interviewer's instructions</li>
              </ol>
              
              <div style=\"text-align: center; margin: 30px 0;\">
                  <a href=\"${interviewLink}\" class=\"cta-button\">🎯 Start Interview Now</a>
              </div>
              
              <p><strong>Alternative Access:</strong> If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p style=\"word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px; font-family: monospace;\">${interviewLink}</p>
              
              <h3>💡 Interview Tips:</h3>
              <ul>
                  <li>Find a quiet space with minimal distractions</li>
                  <li>Test your microphone and speakers beforehand</li>
                  <li>Speak clearly and at a moderate pace</li>
                  <li>Be honest about your experience and skills</li>
                  <li>Take your time to think before answering</li>
                  <li>The AI will ask follow-up questions based on your responses</li>
              </ul>
              
              <div class=\"highlight-box\">
                  <h4>🎤 Technical Requirements:</h4>
                  <p>Make sure you have:</p>
                  <ul>
                      <li>A working microphone</li>
                      <li>Stable internet connection</li>
                      <li>Modern web browser (Chrome, Firefox, Safari, or Edge)</li>
                      <li>Approximately 45 minutes of uninterrupted time</li>
                  </ul>
              </div>
              
              <p>If you encounter any technical issues during the interview, please don't hesitate to contact our HR team for support.</p>
              
              <p>We look forward to learning more about you and your experience. Good luck!</p>
              
              <p>Best regards,<br>
              <strong>HR Team</strong><br>
              Recruitment Department</p>
          </div>
          
          <div class=\"footer\">
              <p>This interview invitation expires on ${expirationDate}</p>
              <p>Please do not reply to this automated email. For support, contact our HR team.</p>
          </div>
      </body>
      </html>
      `;
    }
  }

  // Generate plain text version of invitation email
  generateInvitationEmailText(candidateData, interviewData, language = 'en') {
    const { personalInfo, jobInfo } = candidateData;
    const { sessionKey, expiresAt, interviewLink } = interviewData;
    
    // Format date based on language
    let expirationDate;
    if (language === 'ru') {
      expirationDate = new Date(expiresAt).toLocaleDateString('ru-RU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      expirationDate = new Date(expiresAt).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // Use Russian template if language is Russian, otherwise use English
    if (language === 'ru') {
      return `
Поздравляем! Вы приглашены на интервью

Уважаемый(ая) ${personalInfo.name},

Мы рады сообщить, что ваше резюме на позицию "${jobInfo.title}" было рассмотрено и вы успешно прошли наш первоначальный отбор!

СЛЕДУЮЩИЙ ШАГ: Интервью
Мы хотели бы пригласить вас принять участие в нашем инновационном процессе интервью. Это интервью предназначено для оценки ваших технических навыков, опыта и соответствия корпоративной культуре нашей организации.

ДЕТАЛИ ИНТЕРВЬЮ:
- Позиция: ${jobInfo.title}
- Тип интервью: Техническое и поведенческое интервью
- Продолжительность: Примерно 30-45 минут
- Формат: Голосовая беседа с AI-интервьюером
- Крайний срок: ${expirationDate}

ВАЖНО: У вас есть одна неделя с сегодняшнего дня, чтобы завершить интервью. Интервью можно пройти в любое удобное для вас время, но убедитесь, что вы завершите его до крайнего срока.

ВАША ИНФОРМАЦИЯ ДЛЯ ДОСТУПА К ИНТЕРВЬЮ:
Ключ сессии: ${sessionKey}

ССЫЛКА НА ИНТЕРВЬЮ: ${interviewLink}

ЧТОБЫ НАЧАТЬ ИНТЕРВЬЮ:
1. Нажмите на ссылку выше или скопируйте ее в браузер
2. Введите ваш ключ сессии при появлении запроса
3. Убедитесь, что у вас тихая обстановка и работающий микрофон
4. Следуйте инструкциям AI-интервьюера

СОВЕТЫ ДЛЯ ИНТЕРВЬЮ:
- Найдите тихое место с минимальными отвлекающими факторами
- Проверьте микрофон и динамики заранее
- Говорите четко и в умеренном темпе
- Будьте честны в описании своего опыта и навыков
- Потратьте время на обдумывание ответов

ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ:
- Работающий микрофон
- Стабильное интернет-соединение
- Современный веб-браузер
- Примерно 45 минут непрерывного времени

Если вы столкнетесь с техническими проблемами, пожалуйста, обратитесь к нашей HR-команде за помощью.

Мы с нетерпением ждем возможности узнать больше о вас и вашем опыте. Удачи!

С наилучшими пожеланиями,
HR Команда
Отдел подбора персонала

Это приглашение на интервью истекает ${expirationDate}
Пожалуйста, не отвечайте на это автоматическое письмо.
      `;
    } else {
      // English template (existing code)
      return `
Congratulations! You've been selected for an Interview

Dear ${personalInfo.name},

We are excited to inform you that your CV for the position of \"${jobInfo.title}\" has been reviewed and you have successfully passed our initial screening process!

NEXT STEP: Interview
We would like to invite you to participate in our innovative interview process. This interview is designed to assess your technical skills, experience, and cultural fit for our organization.

INTERVIEW DETAILS:
- Position: ${jobInfo.title}
- Interview Type: Technical & Behavioral Interview
- Duration: Approximately 30-45 minutes
- Format: Voice-based conversation with AI interviewer
- Deadline: ${expirationDate}

IMPORTANT: You have one week from today to complete the interview. The interview can be taken at any time that's convenient for you, but please ensure you complete it before the deadline.

YOUR INTERVIEW ACCESS INFORMATION:
Session Key: ${sessionKey}

INTERVIEW LINK: ${interviewLink}

TO START YOUR INTERVIEW:
1. Click the link above or copy it to your browser
2. Enter your session key when prompted
3. Ensure you have a quiet environment and working microphone
4. Follow the AI interviewer's instructions

INTERVIEW TIPS:
- Find a quiet space with minimal distractions
- Test your microphone and speakers beforehand
- Speak clearly and at a moderate pace
- Be honest about your experience and skills
- Take your time to think before answering

TECHNICAL REQUIREMENTS:
- Working microphone
- Stable internet connection
- Modern web browser
- Approximately 45 minutes of uninterrupted time

If you encounter any technical issues, please contact our HR team for support.

We look forward to learning more about you and your experience. Good luck!

Best regards,
HR Team
Recruitment Department

This interview invitation expires on ${expirationDate}
Please do not reply to this automated email.
      `;
    }
  }

  // Send interview invitation email
  async sendInterviewInvitation(candidate, interviewData) {
    if (!this.initialized || !this.transporter) {
      throw new Error('Email service not initialized. Please check email configuration (EMAIL_USER and EMAIL_PASSWORD environment variables required).');
    }

    try {
      const { personalInfo, jobInfo } = candidate;
      const { sessionKey, expiresAt, interviewLink } = interviewData;
      
      // Determine language from candidate's preferred language
      const language = personalInfo.preferredLanguage || 'en';

      const mailOptions = {
        from: {
          name: language === 'ru' ? 'HR Рекрутинг Команда' : 'HR Recruitment Team',
          address: process.env.EMAIL_USER
        },
        to: personalInfo.email,
        subject: language === 'ru' 
          ? `🎉 Приглашение на интервью - Позиция ${jobInfo.title}` 
          : `🎉 Interview Invitation - ${jobInfo.title} Position`,
        html: this.generateInvitationEmailHtml(candidate, interviewData, language),
        text: this.generateInvitationEmailText(candidate, interviewData, language)
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Interview invitation sent to ${personalInfo.email} in ${language === 'ru' ? 'Russian' : 'English'}`);
      console.log('Email ID:', result.messageId);
      
      return {
        success: true,
        messageId: result.messageId,
        recipient: personalInfo.email,
        sessionKey,
        expiresAt
      };

    } catch (error) {
      console.error('❌ Failed to send interview invitation:', error);
      throw new Error(`Failed to send interview invitation: ${error.message}`);
    }
  }

  // Send reminder email (for future enhancement)
  async sendInterviewReminder(candidate, interviewData) {
    if (!this.initialized || !this.transporter) {
      throw new Error('Email service not initialized. Please check email configuration (EMAIL_USER and EMAIL_PASSWORD environment variables required).');
    }

    try {
      const { personalInfo, jobInfo } = candidate;
      const { sessionKey, expiresAt, interviewLink } = interviewData;
      
      const timeLeft = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
      
      // Determine language from candidate's preferred language
      const language = personalInfo.preferredLanguage || 'en';
      
      const mailOptions = {
        from: {
          name: language === 'ru' ? 'HR Рекрутинг Команда' : 'HR Recruitment Team',
          address: process.env.EMAIL_USER
        },
        to: personalInfo.email,
        subject: language === 'ru'
          ? `⏰ Напоминание: Приглашение на интервью истекает через ${timeLeft} день(дней) - ${jobInfo.title}`
          : `⏰ Reminder: Interview Invitation Expires in ${timeLeft} Day(s) - ${jobInfo.title}`,
        html: language === 'ru'
          ? `
            <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;\">
              <h2>⏰ Напоминание о интервью</h2>
              <p>Уважаемый(ая) ${personalInfo.name},</p>
              <p>Это дружеское напоминание о том, что ваше приглашение на интервью на позицию <strong>${jobInfo.title}</strong> истекает через <strong>${timeLeft} день(дней)</strong>.</p>
              <p>Ваш ключ сессии: <strong>${sessionKey}</strong></p>
              <p><a href=\"${interviewLink}\" style=\"background: #4caf50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;\">Начать интервью сейчас</a></p>
              <p>С наилучшими пожеланиями,<br>HR Команда</p>
            </div>
          `
          : `
            <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;\">
              <h2>⏰ Interview Reminder</h2>
              <p>Dear ${personalInfo.name},</p>
              <p>This is a friendly reminder that your interview invitation for the <strong>${jobInfo.title}</strong> position will expire in <strong>${timeLeft} day(s)</strong>.</p>
              <p>Your Session Key: <strong>${sessionKey}</strong></p>
              <p><a href=\"${interviewLink}\" style=\"background: #4caf50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;\">Start Interview Now</a></p>
              <p>Best regards,<br>HR Team</p>
            </div>
          `,
        text: language === 'ru'
          ? `Напоминание о интервью\n\nУважаемый(ая) ${personalInfo.name},\n\nЭто дружеское напоминание о том, что ваше приглашение на интервью на позицию "${jobInfo.title}" истекает через ${timeLeft} день(дней).\n\nВаш ключ сессии: ${sessionKey}\nСсылка на интервью: ${interviewLink}\n\nС наилучшими пожеланиями,\nHR Команда`
          : `Interview Reminder\n\nDear ${personalInfo.name},\n\nThis is a friendly reminder that your interview invitation for the \"${jobInfo.title}\" position will expire in ${timeLeft} day(s).\n\nYour Session Key: ${sessionKey}\nInterview Link: ${interviewLink}\n\nBest regards,\nHR Team`
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Interview reminder sent to ${personalInfo.email} in ${language === 'ru' ? 'Russian' : 'English'}`);
      
      return {
        success: true,
        messageId: result.messageId,
        recipient: personalInfo.email
      };

    } catch (error) {
      console.error('❌ Failed to send interview reminder:', error);
      throw new Error(`Failed to send interview reminder: ${error.message}`);
    }
  }

  // Test email configuration
  async testEmailConfiguration() {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        return { 
          success: false, 
          configured: false,
          message: 'Email service not configured: EMAIL_USER and EMAIL_PASSWORD environment variables are required' 
        };
      }
      
      if (!this.initialized || !this.transporter) {
        return { 
          success: false, 
          configured: true,
          message: 'Email transporter not initialized. Call initializeTransporter() first.' 
        };
      }
      
      await this.transporter.verify();
      return { 
        success: true, 
        configured: true,
        message: 'Email configuration is valid and working' 
      };
    } catch (error) {
      return { 
        success: false, 
        configured: true,
        message: error.message 
      };
    }
  }
}

// Export singleton instance
export default new EmailService();