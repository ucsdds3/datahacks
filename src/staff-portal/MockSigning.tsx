import { useState } from "react";
import { PREVIEW_WAIVER_PDF } from "./config";

export type MockSessionEnd = "signing_complete" | "cancel" | "decline";

/**
 * Stand-in for DocuSign's embedded signing, used only by `npm run dev` with `?preview`.
 * It ends the "session" the same ways DocuSign can, so the waiver page's lock/unlock
 * logic can be tried without a DocuSign account. `signed` plays the part of the server
 * check: it's only true if a signature was adopted before finishing.
 */
export default function MockSigning({ onEnd }: { onEnd: (end: MockSessionEnd, signed: boolean) => void }) {
  const [name, setName] = useState("");
  const [adopted, setAdopted] = useState<string | null>(null);

  return (
    <div className="sp-mock-signing">
      <div className="sp-mock-bar">
        <strong>Simulated DocuSign</strong>
        <span>Local preview only. Nothing is sent anywhere.</span>
      </div>
      <iframe src={PREVIEW_WAIVER_PDF} title="Waiver document" />
      <div className="sp-mock-sign">
        <label htmlFor="sp-mock-name">Sign here</label>
        {adopted ? (
          <p className="sp-mock-signature">{adopted}</p>
        ) : (
          <div className="sp-mock-adopt">
            <input id="sp-mock-name" value={name} onChange={e => setName(e.target.value)} placeholder="Type your full name" />
            <button className="sp-button" disabled={!name.trim()} onClick={() => setAdopted(name.trim())}>Adopt and sign</button>
          </div>
        )}
      </div>
      <div className="sp-mock-actions">
        <button className="sp-button primary" disabled={!adopted} onClick={() => onEnd("signing_complete", true)}>Finish</button>
        <button className="sp-button" onClick={() => onEnd("cancel", false)}>Close</button>
        <button className="sp-button" onClick={() => onEnd("decline", false)}>Decline</button>
        <button className="sp-link-button" onClick={() => onEnd("signing_complete", false)}>Test: finish with no signature on file</button>
      </div>
    </div>
  );
}
