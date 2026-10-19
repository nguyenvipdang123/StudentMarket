/**
 * Education domains accepted by the password registration flow.
 * The mailbox still has to be verified before the account receives a session.
 */
export function isEducationDomain(domain: string) {
  return /^(?:[a-z0-9-]+\.)+edu(?:\.vn)?$/i.test(domain.trim());
}

export function isEducationEmail(email: string) {
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 && /^[^\s@]+$/.test(parts[0]) && isEducationDomain(parts[1]);
}
