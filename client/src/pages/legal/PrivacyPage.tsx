import LegalLayout from "../../components/legal/LegalLayout";
import { privacySections } from "../../legal/privacy";

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro="This explains what information Owlet collects, why, who can see it, and how you stay in control of it."
      sections={privacySections}
      other={{ label: "Terms of Service", to: "/terms" }}
    />
  );
}