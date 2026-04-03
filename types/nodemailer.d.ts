declare module "nodemailer" {
  export interface Transporter {
    sendMail(mailOptions: unknown): Promise<unknown>;
  }

  export function createTransport(options: unknown): Transporter;
}
