import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'

export default async function Home() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/events') // no org selected; events page will prompt
  redirect('/dashboard')
}
