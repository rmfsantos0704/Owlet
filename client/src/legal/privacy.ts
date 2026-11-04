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
        "your age;",
        "which version of these documents you agreed to, and when.",
      ],
      "Content you create:",
      [
        "web pages and PDFs you save: their text, title, author or authors, publication details (journal, volume, issue, pages, and DOI when available), date, and web address or file name;",
        "when you use \"Save selection to Owlet\" or the Clip button, the extension reads the text you select and, if the page is not saved yet, the page text; it does not read pages automatically;",
        "the tags, citations, reading status, and personal notes or summaries you add, plus AI summaries and key arguments when AI features are on;",
        "when AI features are on, AI workspace results, including the questions you type there;",
        "your highlights (including selected-text positions and PDF page numbers when available), notes, comments, literature-matrix columns and entries, and your collections' names, descriptions, and settings;",
        "who belongs to your collections, and their roles.",
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
        "to run Owlet: saving your clips, generating summaries and citations, and sharing collections with the people you choose;",
        "when a clipped page includes a DOI, to look up its bibliographic metadata from Crossref; only the DOI is sent for that lookup, and a failed lookup falls back to the page's metadata;",
        "to prevent abuse and keep Owlet working;",
        "to follow the law.",
      ],
      "We do not sell your personal data and we do not show advertising.",
    ],
  },
    {
    id: "ai",
    title: "AI features (optional)",
    body: [
      "Owlet can use Groq, an AI provider, for summaries, tags, and the AI workspace. These features can be switched off. When they are off, Owlet does not send your content to any AI provider, and its Quick summary and Build a brief tools run in your own browser.",
      "When AI features are on, Owlet sends the following to Groq, which handles it under its own terms and privacy policy:",
      [
        "when you save a page or PDF, and when you press Regenerate or Run test in a clip's AI summary settings: the clip's text (up to about 12,000 characters; for long PDFs, the beginning and the end), its title, and that clip's custom instructions;",
        "when you use the AI workspace: passages from the saved sources you select (up to about 24,000 characters in total), their titles, and the question or focus you type.",
      ],
      "While AI features are on, don't save anything confidential or that you are not allowed to share with a third-party AI provider.",
    ],
  },
  {
    id: "sharing",
    title: "Who sees your information",
    body: [
      "Members of a Collection can see its content and each other's email addresses. Comments show their author's email. Other Owlet users cannot see your age or your role.",
      `Service providers help us run Owlet: hosting (${LEGAL.hostingProviders}), our database (MongoDB Atlas), email delivery (${LEGAL.emailProvider}), Crossref for DOI metadata lookups, and, when AI features are on, Groq. They process data only to provide those services.`,
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
        "your Personal Collection and any shared Collection you choose to delete are deleted with all their clips;",
        "shared collections you choose to transfer move to another member;",
        "clips and comments you added to collections owned by other people stay with those collections, without your name or email.",
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
      "We protect your data with measures such as hashed passwords, email confirmation, rate limits on sign-in and account actions, encrypted connections, and access controls on collections. No system is perfectly secure. If a breach affects your data, we will tell you as the law requires.",
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