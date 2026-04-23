// WhatsApp "click-to-send" deep links.
// The user taps a link on their phone, WhatsApp opens with the body pre-filled,
// they pick the recipient (group/community/contact) and hit send. This keeps the
// message "from" their personal account, so recipients see it as authentic.

export function buildWhatsAppDeepLink(body: string): string {
  // wa.me works across iOS/Android/desktop and opens to the recipient-picker.
  return `https://wa.me/?text=${encodeURIComponent(body)}`
}

// A recipient-specific deep link. `phone` must be E.164 digits only, no +.
export function buildWhatsAppDirectLink(phone: string, body: string): string {
  const digits = phone.replace(/\D+/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`
}
