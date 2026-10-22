import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  return (
  <div className="mc-application-form">
      <div className="mc-application-preview-label">
        <span /> YOUR NEXT ADVENTURE
      </div>

      <h2>Ready to join DataHacks?</h2>

      <p className="mc-form-disclaimer">
        Your next adventure starts here. Create an account
        with Google to get started on your hacker application.
      </p>

      <div className="mc-form-actions">
        <button
          type="button"
          className="mc-button"
          onClick={() => navigate("/login/hacker")}
          style={{
            width: "100%",
            justifyContent: "center",
          }}
        >
          Create an Account <ArrowRight size={17} />
        </button>
      </div>

      <p className="mc-form-help">
        Already have an account? Continue with Google on the
        next page.
      </p>
      </div>
);
}
