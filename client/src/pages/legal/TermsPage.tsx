import LegalLayout from "../../components/legal/LegalLayout";
import { termsSections } from "../../legal/terms";

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro="These are the rules for using Owlet. We've written them in plain language, and they're short enough to read before you sign up."
      sections={termsSections}
      other={{ label: "Privacy Policy", to: "/privacy" }}
    />
  );
}