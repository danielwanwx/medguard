import { forwardRef } from "react";
import { LoaderCircle } from "lucide-react";

export const Button = forwardRef(function Button({
  children,
  className = "",
  variant = "primary",
  loading = false,
  type = "button",
  ...props
}, ref) {
  return (
    <button ref={ref} type={type} className={`mg-button mg-button--${variant} ${className}`.trim()} {...props}>
      {loading && <LoaderCircle aria-hidden="true" className="mg-button__spinner" size={18} />}
      {children}
    </button>
  );
});

export function IconButton({ label, children, className = "", ...props }) {
  return (
    <button type="button" aria-label={label} title={label} className={`mg-icon-button ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export function Badge({ children, tone = "neutral", className = "" }) {
  return <span className={`mg-badge mg-badge--${tone} ${className}`.trim()}>{children}</span>;
}

export function Field({ label, hint, htmlFor, children, className = "" }) {
  return (
    <div className={`mg-field ${className}`.trim()}>
      {label && <label htmlFor={htmlFor} className="mg-field__label">{label}</label>}
      {hint && <p className="mg-field__hint">{hint}</p>}
      {children}
    </div>
  );
}

export function SourceLink({ href, children, className = "" }) {
  if (!href) return <span className={`mg-source mg-source--plain ${className}`.trim()}>{children}</span>;
  return (
    <a className={`mg-source ${className}`.trim()} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}
