import nodemailer from 'nodemailer';

export const verify_transporter = nodemailer.createTransport({
	host: 'smtp.ionos.co.uk',
	port: 465,
	secure: true,
	auth: {
		user: process.env.SMTP_VERIFY_USER,
		pass: process.env.SMTP_VERIFY_PASS,
	},
});
export const payment_transporter = nodemailer.createTransport({
	host: 'smtp.ionos.co.uk',
	port: 465,
	secure: true,
	auth: {
		user: process.env.SMTP_PAYMENT_USER,
		pass: process.env.SMTP_PAYMENT_PASS,
	},
});
export const no_reply_transporter = nodemailer.createTransport({
	host: 'smtp.ionos.co.uk',
	port: 465,
	secure: true,
	auth: {
		user: process.env.SMTP_NOREPLY_USER,
		pass: process.env.SMTP_NOREPLY_PASS,
	},
});
