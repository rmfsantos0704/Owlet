import { LEGAL } from "./config";
import type { Section } from "./types";

export const termsSections: Section[] = [
  {
    id: "about",
    title: "About these Terms",
    body: [
      `These Terms of Service ("Terms") are an agreement between you and ${LEGAL.operator} ("we", "us"), who run ${LEGAL.appName}: a web app and browser extension for saving web pages and PDFs, getting AI summaries and citations, and organizing research in collections.`,
      "By creating an account or using Owlet you agree to these Terms and to our Privacy Policy. If you don't agree, please don't use Owlet.",
    ],
  },
  {
    id: "eligibility",
    title: "Who can use Owlet",
    body: [
      "You must be at least 13 years old. If you are under the age of majority where you live, you confirm that a parent or guardian allows you to use Owlet wherever the law requires that.",
      "You can't use Owlet if we have previously closed your account for breaking these Terms.",
    ],
  },
  {
    id: "account",
    title: "Your account",
    body: [
      "Give us accurate information (including your email address, age, and role) and keep it up to date. You must confirm your email address before you can use your account.",
      "Keep your password private and don't share your account. You are responsible for everything that happens under it. Tell us promptly if you think someone else has gained access.",
      "From the Account page you can change your password, email, age, and role, sign out of all devices, download your data, or delete your account at any time.",
    ],
  },
  {
    id: "content",
    title: "Your content",
    body: [
      "Your content means the pages and PDFs you save, the summaries, tags, and citations created for them, and your highlights, notes, comments, and Collection settings. You keep ownership of your content.",
      "You give us a limited licence to store, process, and display your content, and to show it to the people you share a Collection with, only so that we can run Owlet for you. This includes sending the text of what you save to our AI provider to produce summaries and tags.",
      "You are responsible for your content. Only save or share material you have the right to use. Owlet is meant for personal study and research: don't use shared collections or exports to republish or distribute other people's copyrighted material without permission.",
      `If you believe something in Owlet infringes your rights, contact us at ${LEGAL.contactEmail}. We will review it and may remove it.`,
    ],
  },
  {
    id: "sharing",
    title: "Collections and sharing",
    body: [
      "The owner of a Collection decides who can join it and what each person can do (owner, editor, or viewer). Members can see everything in the Collection and the email addresses of its other members. Editors can add and change clips, highlights, comments, and tags.",
      "If a Collection owner deletes their account, they must choose, for each shared Collection, whether to transfer it to a member or delete it. Clips and comments you add to a Collection owned by someone else stay with that Collection if you later delete your account, but without your name or email.",
    ],
  },
  {
    id: "ai",
    title: "AI summaries and citations",
    body: [
      "Summaries, key arguments, tags, and citations are generated automatically. They can be incomplete or wrong, and citation formats (APA, MLA, Chicago) may not match the latest style guide or your instructor's requirements.",
      "Always check them against the original source before you rely on them or hand in work. You are responsible for your own academic integrity and for the accuracy of anything you publish or submit.",
      "Don't save confidential or sensitive information that you are not allowed to send to a third-party AI provider.",
    ],
  },
  {
    id: "use",
    title: "Acceptable use",
    body: [
      "Don't use Owlet to:",
      [
        "break the law or other people's rights;",
        "upload malware, or try to damage, overload, or get around the limits of Owlet, including rate limits;",
        "access other people's accounts or data, or look for security weaknesses without our written permission;",
        "send spam or harass anyone, including through Collection invitations or comments;",
        "save or share illegal content, or material that sexually exploits or endangers children;",
        "create accounts automatically or scrape Owlet.",
      ],
    ],
  },
  {
    id: "service",
    title: "Availability and changes",
    body: [
      "Owlet is an early-stage service provided free of charge. We may change, limit, or stop features at any time, and the service may be unavailable from time to time.",
      "We take care to protect your data, but no service is perfectly reliable. Use Download my data on the Account page to keep your own copy of anything important.",
    ],
  },
  {
    id: "ending",
    title: "Ending your account",
    body: [
      "You can delete your account at any time from the Account page. What happens to your data is explained in the Privacy Policy.",
      "We may suspend or close an account that breaks these Terms or puts Owlet or other people at risk. Where we reasonably can, we will tell you why.",
    ],
  },
  {
    id: "warranty",
    title: "Disclaimers",
    body: [
      'To the extent the law allows, Owlet is provided "as is" and "as available", without promises that it will be error-free, uninterrupted, or suitable for a particular purpose. Nothing in these Terms removes rights you have under law that cannot be waived.',
    ],
  },
  {
    id: "liability",
    title: "Limit of liability",
    body: [
      "To the extent the law allows, we are not liable for indirect or consequential losses, lost data, or lost grades, opportunities, or profits arising from your use of Owlet. Because Owlet is free, our total liability for any claim is limited to the amount you paid us in the 12 months before the claim (which is zero), except where the law does not allow this limit.",
    ],
  },
  {
    id: "changes",
    title: "Changes to these Terms",
    body: [
      "We may update these Terms. The version and date are shown at the top of this page. If we make a material change, we will tell you by email or in the app before it takes effect. If you keep using Owlet after that, you accept the updated Terms.",
    ],
  },
  {
    id: "law",
    title: "Governing law and contact",
    body: [`These Terms are governed by ${LEGAL.governingLaw}. Questions? Contact us at ${LEGAL.contactEmail}.`],
  },
];