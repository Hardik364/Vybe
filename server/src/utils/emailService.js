import nodemailer from 'nodemailer'

// Create transporter from env vars
// Using explicit host/port instead of service:'gmail' so we can force IPv4.
// Render free tier has no IPv6 — smtp.gmail.com resolves to IPv6 by default.
function createTransporter() {
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,           // SSL on port 465
        family: 4,              // force IPv4 — fixes ENETUNREACH on Render free tier
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        }
    })
}

export async function sendOtpEmail(toEmail, otp, username) {
    const transporter = createTransporter()

    const mailOptions = {
        from: `"UniBuddy" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `${otp} is your UniBuddy verification code`,
        html: `
        <div style="font-family: Inter, Arial, sans-serif; background: #0D0D0D; color: #fff; padding: 40px; border-radius: 16px; max-width: 480px; margin: 0 auto;">
            <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">
                <span style="color: #6C63FF;">✦</span> UniBuddy
            </div>
            <p style="color: #A0A0A0; margin-bottom: 32px;">Real conversations. Your college.</p>

            <p style="margin-bottom: 16px;">Hey <strong>${username}</strong>,</p>
            <p style="color: #A0A0A0; margin-bottom: 24px;">Your verification code is:</p>

            <div style="background: #1A1A1A; border: 1px solid #2A2A2A; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #6C63FF;">${otp}</span>
            </div>

            <p style="color: #555; font-size: 13px;">This code expires in <strong style="color: #A0A0A0;">10 minutes</strong>.</p>
            <p style="color: #555; font-size: 13px;">If you didn't request this, ignore this email.</p>
        </div>
        `
    }

    await transporter.sendMail(mailOptions)
    console.log(`[Email] OTP sent to ${toEmail}`)
}
