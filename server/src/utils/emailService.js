// emailService.js — sends OTP emails via Brevo HTTP API
// Brevo (brevo.com) free tier: 300 emails/day, no domain needed
// Just verify your Gmail as a sender in Brevo dashboard
// Add BREVO_API_KEY to Render environment variables

export async function sendOtpEmail(toEmail, otp, username) {
    const apiKey = process.env.BREVO_API_KEY
    if (!apiKey) throw new Error('BREVO_API_KEY is not set')

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method:  'POST',
        headers: {
            'accept':       'application/json',
            'api-key':      apiKey,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            sender: {
                name:  'UniBuddy',
                email: process.env.EMAIL_USER,   // your verified Gmail in Brevo
            },
            to: [{ email: toEmail }],
            subject: `${otp} is your UniBuddy verification code`,
            htmlContent: `
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
        })
    })

    const data = await res.json()

    if (!res.ok) {
        console.error('[Email] Brevo error:', data)
        throw new Error(data.message || 'Failed to send email')
    }

    console.log(`[Email] OTP sent to ${toEmail} — messageId: ${data.messageId}`)
}
