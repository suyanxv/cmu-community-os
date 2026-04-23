import { Resend } from 'resend'

let _resend: Resend | undefined

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set')
    }
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

export interface SendEmailInput {
  to: string
  subject: string
  text: string
  replyTo?: string | null
  fromName?: string | null
}

export interface SendEmailResult {
  ok: boolean
  id?: string
  error?: string
}

export function getFromAddress(fromName?: string | null): string {
  const address = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
  const name = (fromName ?? process.env.RESEND_FROM_NAME ?? '').trim()
  return name ? `${name} <${address}>` : address
}

// Convert plain text body into safe HTML: escape, preserve line breaks, auto-link URLs.
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#2a7a5e;">$1</a>'
  )

  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px;">
${linked.replace(/\n/g, '<br>')}
</body></html>`
}

export async function sendEmail({ to, subject, text, replyTo, fromName }: SendEmailInput): Promise<SendEmailResult> {
  try {
    const result = await getResend().emails.send({
      from: getFromAddress(fromName),
      to,
      subject,
      text,
      html: textToHtml(text),
      replyTo: replyTo ?? undefined,
    })
    if (result.error) {
      return { ok: false, error: result.error.message ?? String(result.error) }
    }
    return { ok: true, id: result.data?.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
