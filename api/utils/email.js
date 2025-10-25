import nodemailer from 'nodemailer';

async function createTransport() {
  if (
    !process.env.EMAIL_HOST ||
    !process.env.EMAIL_PORT ||
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_PASS
  ) {
    console.error('Missing required email environment variables');
    // In a real application, you might want to throw an error
    // or handle this case more gracefully.
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
}

/**
 * Sends an email.
 *
 * @param {object} mailOptions - The mail options.
 * @param {string} mailOptions.to - The recipient's email address.
 * @param {string} mailOptions.subject - The subject of the email.
 * @param {string} mailOptions.text - The plain text body of the email.
 * @param {string} [mailOptions.html] - The HTML body of the email.
 * @returns {Promise<boolean>} - A promise that resolves to true if the email was sent successfully, and false otherwise.
 */
export async function sendEmail({ to, subject, text, html }) {
  const transporter = await createTransport();
  if (!transporter) {
    return false;
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER, // sender address
    to,
    subject,
    text,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}
