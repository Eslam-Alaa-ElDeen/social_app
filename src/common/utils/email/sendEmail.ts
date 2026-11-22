import nodemailer, { SendMailOptions } from "nodemailer";
import { APP_EMAIL, APP_PASSWORD, PROJECT_NAME } from "../../../config/config.service.js";
import { BadRequestException } from "../../exception/app.exception.js";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: APP_EMAIL || process.env.APP_EMAIL,
        pass: APP_PASSWORD || process.env.APP_PASSWORD
    }
});

export const sendEmail = async ({
    to,
    subject,
    html,
    text,
    attachments = []
}: {
    to?: string | string[];
    subject?: string;
    html?: string;
    text?: string;
    attachments?: SendMailOptions["attachments"];
}) => {
    try {
        if (!to) {
            throw new BadRequestException("missing email recipient");
        }

        const emailUser = APP_EMAIL || process.env.APP_EMAIL;
        const senderName = PROJECT_NAME || "Social App";

        const info = await transporter.sendMail({
            from: `"${senderName}" <${emailUser}>`,
            to,
            subject,
            text,
            html,
            attachments
        });

        console.log("Email sent successfully via Nodemailer:", info.messageId);
        return info;
    } catch (err) {
        console.error("Error while sending mail via Nodemailer:", err);
        throw err;
    }
};