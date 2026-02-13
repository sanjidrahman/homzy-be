const SibApiV3Sdk = require('@getbrevo/brevo');

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

const sendOTPEmail = async (email, otp) => {
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

  sendSmtpEmail.sender = { email: process.env.EMAIL_USER, name: 'Home Baker Marketplace' };
  sendSmtpEmail.to = [{ email }];
  sendSmtpEmail.subject = 'Email Verification - Home Baker Marketplace';
  sendSmtpEmail.htmlContent = `
    <h2>Email Verification</h2>
    <p>Your OTP for email verification is:</p>
    <h1 style="color: #4CAF50;">${otp}</h1>
    <p>This OTP will expire in 10 minutes.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;

  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

module.exports = { sendOTPEmail };
