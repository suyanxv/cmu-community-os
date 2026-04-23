import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Quorum</h1>
          <p className="mt-2 text-gray-500">Community Event OS</p>
        </div>
        <SignIn />
      </div>
    </div>
  )
}
