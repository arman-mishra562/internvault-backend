export const generateVerificationEmail = (link: string) => {
	return `
      <h2>Welcome to InternVault</h2>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${link}">Verify your email</a>
    `;
};

export function generateResetEmail(link: string) {
	return `
    <h2>Password Reset Request</h2>
    <p>Click the link below to reset your password (valid for 1 hour):</p>
    <a href="${link}">Reset your Password</a>
  `;
}
export function generatePaymentEmail(
	domain: string,
	name: string,
	duration: string,
	startDate: string,
	unlockDate: string,
) {
	return `
    <h3>Hi ${name}</h3>
    <p>We’ve received your payment successfully. Your internship journey has officially begun!</p>
    <p>🔹Internship Domain: ${domain}</p>
    <p>🔹Duration: ${duration}</p>
    <p>🔹Start Date: ${startDate}</p>
    <p>🔹Certificate Unlock Date: ${unlockDate}</p>
    <p>Your first project will be available in your dashboard shortly. Let’s start building your future—one project at a time.</p>
    <a href="https://internvault.com/user-dashboard">Open your Dashboard</a>
    
    <p>Thanks for choosing InternVault!</p>
    <p><em>Team InternVault</em></p>
  `;
}
export function generateProjectEmail(
	domain: string,
	name: string,
	endDate: string,
	projectName: string,
) {
	return `
    <h3>Hi ${name}</h3>
    <p>Your project under the ${domain} track is now available on your dashboard.</p>
    <p><b>Project Name</b>: ${projectName}</p>
    <p><b>Deadline</b>: Submit before ${endDate} to stay on track</p>
    <p>Your certificate countdown is running. Submit on time to unlock your official UK internship certificate.</p>
    <a href="https://internvault.com/user-dashboard">View Project & Submit</a>

    <p>Keep building your skills!</p>
    <p><em>Team InternVault</em></p>
  `;
}
