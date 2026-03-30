const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
    }
});

const option = {
    "verifyEmail": {
        subject: "Verify Your Account",
        text: (token) => `Please verify your account by clicking the following link: ${process.env.FRONTEND_URL}/verify-email?token=${token}`
    },
    "resetPassword": {
        subject: "Reset Your Password",
        text: (token) => `You can reset your password by clicking the following link: ${process.env.FRONTEND_URL}/reset-password?token=${token}`
    }
}

async function sendEmail(userMail, token, mailType) {
    if (!option[mailType]) throw new AppError("Invalid mail type", 500);

    const mailOptions = {
        from: process.env.EMAIL_USERNAME,
        to: userMail,
        subject: option[mailType].subject,
        text: option[mailType].text(token)
    };

    await transporter.sendMail(mailOptions)
}

module.exports = {
    sendEmail
}