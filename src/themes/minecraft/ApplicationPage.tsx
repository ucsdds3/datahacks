import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CheckCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


const initial = { name: "", email: "", school: "", experience: "First hackathon", team: "Looking for teammates", motivation: "" };
const steps = ["Your player", "Your adventure", "Review"];

export default function ApplicationPage() {
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState(initial);
  const [complete, setComplete] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  useEffect(() => { if (mounted.current) heading.current?.focus(); mounted.current = true; }, [step, complete]);
  const set = (key: keyof typeof initial, value: string) => setDetails(previous => ({ ...previous, [key]: value }));
  const next = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setStep(value => Math.min(value + 1, 2)); };
  const [signInError, setSignInError] = useState<string | null>(null);
  // Straight to Google's account picker, no separate sign-in page. Loaded on
  // click so the Supabase client stays out of the site's own bundle.
  const signIn = (as: "hacker" | "staff") =>
    import("@/portal/signIn")
      .then(m => m.startGoogleSignIn(as))
      .catch(error => setSignInError(error instanceof Error ? error.message : String(error)));

  return (
  <div className="mc-application-form">
      <div className="mc-application-preview-label">
        <span /> YOUR NEXT ADVENTURE
      </div>

      <h2>Ready to join DataHacks?</h2>

      <p className="mc-form-disclaimer">
        Your next adventure starts here. Sign in with Google to start
        your application, or to check on one you've already sent.
      </p>

      <div className="mc-form-actions">
        <button
          type="button"
          className="mc-button"
          onClick={() => signIn("hacker")}
          style={{
            width: "100%",
            justifyContent: "center",
          }}
        >
          Apply as a hacker <ArrowRight size={17} />
        </button>
        <button
          type="button"
          className="mc-button mc-button-stone"
          onClick={() => signIn("staff")}
          style={{
            width: "100%",
            justifyContent: "center",
          }}
        >
          Apply to mentor or judge <ArrowRight size={17} />
        </button>
      </div>

      {signInError && <p className="mc-form-help" style={{ color: "#c96b6b" }}>{signInError}</p>}
      </div>
);
}
