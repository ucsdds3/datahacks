import { DOCUSIGN, type DocuSignConfig } from "./config";

/**
 * The waiver's PowerForm link, filled in for one person. DocuSign's documented
 * PowerForm URL parameters ("Parameters to Pre-Populate Information in a
 * PowerForm", support.docusign.com, Docusign eSignature - PowerForms):
 *
 *   &<RoleName>_UserName=<name>         the signer's name
 *   &<RoleName>_Email=<email>           the signer's email
 *   &<DataLabel>=<value>                a field, by its data label
 *   &<RoleName>_<DataLabel>=<value>     the same, naming the role
 *
 * The id field's label (datahacks_id) has an underscore, which DocuSign also
 * uses between role and label, and users report that bare labels with an
 * underscore don't fill in. So the id goes in both forms; whichever DocuSign
 * reads fills the field, and an unused parameter is ignored. If the field still
 * comes out empty, the CSV import matches by email instead.
 */
export type WaiverSigner = { name: string; email: string; id: string };

type LinkConfig = Pick<DocuSignConfig, "powerFormUrl" | "roleName" | "idFieldLabel">;

// encodeURIComponent leaves ! ' ( ) * as they are; DocuSign's own examples
// percent-encode everything but letters and digits, so do the same.
const encode = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export function powerFormLink(signer: WaiverSigner, config: LinkConfig = DOCUSIGN): string | null {
  const base = config.powerFormUrl.trim();
  if (!base) return null;
  const role = config.roleName.trim();
  const params: [string, string][] = [];
  const name = signer.name.normalize("NFC").replace(/\s+/g, " ").trim();
  const email = signer.email.trim();
  const id = signer.id.trim();
  if (role && name) params.push([`${role}_UserName`, name]);
  if (role && email) params.push([`${role}_Email`, email]);
  if (id && config.idFieldLabel) {
    if (role) params.push([`${role}_${config.idFieldLabel}`, id]);
    params.push([config.idFieldLabel, id]);
  }
  if (!params.length) return base;
  const query = params.map(([k, v]) => `${encode(k)}=${encode(v)}`).join("&");
  const joiner = base.includes("?") ? (/[?&]$/.test(base) ? "" : "&") : "?";
  return `${base}${joiner}${query}`;
}

/** The Sign button is live: PowerForm mode, a link, and the final waiver wording is in. */
export const powerFormOpen = (config: Pick<DocuSignConfig, "mode" | "powerFormUrl" | "waiverPublished"> = DOCUSIGN) =>
  config.mode === "powerform" && config.waiverPublished && config.powerFormUrl.trim() !== "";
