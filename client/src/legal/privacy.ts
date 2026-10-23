import { LEGAL } from "./config";
import type { Section } from "./types";

export const privacySections: Section[] = [
  {
    id: "who",
    title: "Who we are",
    body: [
      `${LEGAL.operator} ("we", "us") runs ${LEGAL.appName} and is responsible for your personal data. Contact: ${LEGAL.contactEmail}. Address: ${LEGAL.address}.`,
    ],
  },
  {
    id: "collect",
    title: "What we collect",
    body: [
      "Account information:",
      [
        "your email address;",
        "your password, which we store only as a salted one-way hash (we cannot read it);",
        "your age and your role (student, teacher, researcher, working professional, or other);",
        "which version of these documents you agreed to, and when.",
      ],
      "Content you create:",
      [
        "web pages and PDFs you save: their text, title, author, date, and web address or file name;",
        "the AI summaries, key arguments, tags, and citations generated for them;",
        "your highlights, notes, comments, and your workspaces' names, descriptions, and settings;",
        "who belongs to your workspaces, and their roles.",
      ],
      "Technical information: our servers and hosting providers may log IP addresses and request details for security, abuse prevention, and troubleshooting. We use your IP address to apply rate limits.",
      "We do not use advertising cookies or third-party analytics. We keep your login token in your browser's local storage (and the extension's storage) so you stay signed in.",
    ],
  },
  {
    id: "use",
    title: "How we use it",
    body: [
      [
        "to create and secure your account, including emailing you confirmation, password-reset, and security messages;",
        "to run Owlet: saving your clips, generating summaries and citations, and sharing workspaces with the people you choose;",
        "to prevent abuse and keep Owlet working;",
        "to follow the law.",
      ],
      "We do not sell your personal data and we do not show advertising.",
    ],
  },
  {
    id: "ai",
    title: "AI processing",
    body: [
      "When you save a page or PDF, Owlet sends its text (up to about 12,000 characters; for long PDFs, the beginning and the end), its title, and your workspace's custom instructions to Groq, our AI provider, to create the summary, key arguments, and tags. The Regenerate button and the Test panel in workspace settings do the same. Groq handles this under its own terms and privacy policy.",
      "Don't save anything confidential or that you are not allowed to share with a third-party AI provider.",
    ],
  },
  {
    id: "sharing",
    title: "Who sees your information",
    body: [
      "Members of a workspace can see its content and each other's email addresses. Comments show their author's email. Other Owlet users cannot see your age or your role.",
      `Service providers help us run Owlet: hosting (${LEGAL.hostingProviders}), our database (MongoDB Atlas), email delivery (${LEGAL.emailProvider}), and AI summaries (Groq). They process data only to provide those services.`,
      "We may disclose information if the law requires it or to protect people's safety or rights.",
    ],
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: [
      "We keep your account and content until you delete them. When you delete your account (Account page, then Delete account):",
      [
        "your account, profile, and login are removed immediately;",
        "your Personal workspace and any shared workspace you choose to delete are deleted with all their clips;",
        "shared workspaces you choose to transfer move to another member;",
        "clips and comments you added to workspaces owned by other people stay with those workspaces, without your name or email.",
      ],
      `Backups and server logs may keep copies for up to ${LEGAL.backupDays} days before they are removed.`,
    ],
  },
  {
    id: "rights",
    title: "Your choices and rights",
    body: [
      "You can do all of this yourself on the Account page: download a copy of your data, correct your profile and email, change your password, sign out of every device, and delete your account.",
      "Depending on where you live, you may also have the right to be informed about how your data is used, to object, to have your data corrected or erased, to data portability, and to complain to your data protection authority. In the Philippines, the Data Privacy Act of 2012 gives you rights like these, and you can complain to the National Privacy Commission.",
      `To use a right you can't exercise on the Account page, contact ${LEGAL.contactEmail}.`,
    ],
  },
  {
    id: "children",
    title: "Children",
    body: [
      "Owlet is for people aged 13 and over. We ask for your age when you sign up, and we do not knowingly collect information from anyone younger. If we learn that we have, we will delete it.",
    ],
  },
  {
    id: "security",
    title: "Security",
    body: [
      "We protect your data with measures such as hashed passwords, email confirmation, rate limits on sign-in and account actions, encrypted connections, and access controls on workspaces. No system is perfectly secure. If a breach affects your data, we will tell you as the law requires.",
    ],
  },
  {
    id: "transfers",
    title: "Where your data is processed",
    body: [
      "Our providers may store or process data in other countries, including outside the Philippines. We choose providers that commit to protecting it.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: [
      "We may update this policy. The version and date are shown at the top. If we make a material change, we will tell you by email or in the app before it takes effect.",
    ],
  },
];