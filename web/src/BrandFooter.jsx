// BrandFooter.jsx - Public page footer: "Powered by Z Cloud Digitech" + contact
import { BRAND } from "./brand";

export default function BrandFooter() {
  const contact =
    BRAND.website ||
    (BRAND.email && `mailto:${BRAND.email}`) ||
    (BRAND.whatsapp && `https://wa.me/${BRAND.whatsapp}`) ||
    (BRAND.phone && `tel:${BRAND.phone.replace(/\s/g, "")}`);

  return (
    <footer className="site-footer">
      <span>Powered by {BRAND.company}</span>
      <span>
        Want an AI call agent for your business?{" "}
        {contact ? (
          <a href={contact} target="_blank" rel="noreferrer">Contact {BRAND.company}</a>
        ) : (
          <b>Contact {BRAND.company}</b>
        )}
      </span>
    </footer>
  );
}
