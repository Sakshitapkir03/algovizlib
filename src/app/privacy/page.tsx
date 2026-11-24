import type { Metadata } from "next";
import Link from "next/link";

import { ExternalLink, LegalPage, LegalSection, Mail } from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What algovizlib stores, why, and how to have it deleted.",
};

/**
 * Keep this accurate to what the code does. If sign-in, storage, providers, or narration change (for example,
 * turning on email + password), update this page and its effective date in the same change.
 */
const EFFECTIVE = "2026-11-24";

export default function PrivacyPage() {
  return (
    <LegalPage
      slug="privacy"
      title="Privacy policy"
      effective={EFFECTIVE}
      summary={
        <p>
          algovizlib is a free, non-commercial learning site. You can use all of it without an account. If you
          sign in, we keep only what&apos;s needed to save your learning progress. We don&apos;t sell or share
          your data, show ads, or track you.
        </p>
      }
    >
      <LegalSection title="Without an account">
        <p>
          Your progress (each problem&apos;s status), where you stopped in each video, your answers to the
          videos&apos; quick check questions (which question, right or not, and when; for a walkthrough of
          your own input, that input too), your review schedule (when you last marked each problem reviewed,
          its review interval, and any snooze), your theme, your sound and quick check settings, and whether
          you&apos;ve dismissed a tip are saved in your browser&apos;s local storage. They never leave your
          device. Clearing this site&apos;s data in your browser removes them.
        </p>
      </LegalSection>

      <LegalSection title="Signing in">
        <p>
          Signing in is optional. Its only purpose is to save your progress to an account, so it follows you
          across devices. You can sign in with GitHub or Google. Email and password sign-in is currently
          turned off.
        </p>
        <p>
          When you sign in, GitHub or Google tells us your name, email address, profile picture, and an
          account number for your profile with them. With GitHub, we also check once, during sign-in, that
          GitHub has verified your email address. We don&apos;t keep GitHub&apos;s or Google&apos;s access
          tokens. We don&apos;t read or post anything else in those accounts.
        </p>
        <p>
          If you were using the site without an account, the progress, quick check answers, and review
          schedule in your browser are moved into your account when you sign in, then removed from the
          browser.
        </p>
      </LegalSection>

      <LegalSection title="What we store">
        <ul>
          <li>
            Your account: name, email address, profile picture link, which provider you signed in with (and
            its account number), when your email was confirmed, and when the account was created.
          </li>
          <li>
            Your progress: for each problem you&apos;ve started, its status (not started, learning, done),
            whether you set it yourself, and when it changed.
          </li>
          <li>Video positions: the scene and second where you stopped each video, until you finish it.</li>
          <li>
            Quick check answers: for each question you answer, the problem, which question, whether you were
            right, and when; for a walkthrough of your own input, the input. Skipped questions aren&apos;t
            recorded, and answers never change your progress.
          </li>
          <li>
            Your review schedule: for each problem you&apos;ve marked reviewed or snoozed, when you last
            reviewed it, its review interval, and until when it&apos;s snoozed. The review queue itself is
            worked out from your progress and quick check answers each time you open it.
          </li>
          <li>
            If you use &ldquo;Ask about this step&rdquo;: how many questions you asked today (to enforce the
            daily limit), deleted about a day after the limit resets. Your questions and their answers
            aren&apos;t stored with your account.
          </li>
        </ul>
        <p>
          This is stored in a Postgres database hosted by{" "}
          <ExternalLink href="https://neon.com/privacy-policy">Neon</ExternalLink>. The site runs on{" "}
          <ExternalLink href="https://vercel.com/legal/privacy-policy">Vercel</ExternalLink>.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and logs">
        <p>
          When you sign in, the site sets only the cookies sign-in needs: one that keeps you signed in, and
          short-lived ones that protect the sign-in itself. There are no advertising or analytics cookies, and
          no third-party trackers.
        </p>
        <p>
          To prevent abuse, sign-in attempts are counted by IP address and email address. Those counts are
          deleted within about a day. Like any website, Vercel keeps standard request logs (such as IP address
          and browser type) to run and secure the site.
        </p>
      </LegalSection>

      <LegalSection title="What we don't do">
        <ul>
          <li>We don&apos;t sell, rent, or share your data with anyone.</li>
          <li>We don&apos;t show ads.</li>
          <li>We don&apos;t use analytics or tracking beyond what&apos;s needed to run the site.</li>
        </ul>
        <p>
          The only services that handle your data are the ones that run the site: Vercel (hosting), Neon (the
          database), GitHub or Google (only when you sign in with them), and Google&apos;s Gemini API (only
          the questions you ask the tutor, as described below). Your profile picture is loaded from their
          servers.
        </p>
      </LegalSection>

      <LegalSection title="Ask about this step">
        <p>
          Signed-in users can ask an AI tutor about the moment of a video they&apos;re watching. Your
          question, together with that problem&apos;s text and the video&apos;s current step, is sent to
          Google&apos;s <ExternalLink href="https://ai.google.dev/gemini-api/terms">Gemini API</ExternalLink>{" "}
          to generate the answer. Nothing about you goes with it: no name, email address, or account details.
          Don&apos;t put personal information in a question.
        </p>
        <p>
          The tutor uses Google&apos;s free tier, under which Google may use what&apos;s sent to it (your
          question and the step) to improve its products, as its terms describe. Answers to the suggested
          questions are kept, without anything that identifies who asked, so the same question on the same
          step can be answered again without asking Google. Answers are generated by AI and can be wrong.
        </p>
      </LegalSection>

      <LegalSection title="Narration">
        <p>
          Video voice-overs were generated in advance with{" "}
          <ExternalLink href="https://elevenlabs.io">ElevenLabs</ExternalLink> from the video scripts and are
          served from this site. Playing a video sends nothing about you to ElevenLabs. Videos without a
          voice-over use your browser&apos;s built-in voice. Some browsers&apos; voices are online services
          that receive the text being read: the video&apos;s narration, nothing about you.
        </p>
      </LegalSection>

      <LegalSection title="Keeping and deleting your data">
        <p>
          Your account, progress, quick check answers, and review schedule are kept until you ask us to delete
          them. To delete your account, email <Mail /> from the address on your account. We&apos;ll delete
          your account, your progress, your video positions, your quick check answers, and your review
          schedule, and confirm within 30 days. Copies may remain in the database provider&apos;s short-term
          backups for a limited time before they expire.
        </p>
        <p>
          You can also remove algovizlib&apos;s access in your GitHub or Google account settings at any time.
          To ask what we hold about you or to correct it, use the same address.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          algovizlib isn&apos;t directed at children under 13, and we don&apos;t knowingly collect their data.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          If this policy changes, we&apos;ll update it here and change the effective date. Questions: <Mail />
          . See also the{" "}
          <Link href="/terms" className="text-primary underline underline-offset-4">
            terms of use
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
