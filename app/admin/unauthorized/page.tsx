import Link from 'next/link'

export default function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="paper-card p-8 w-full max-w-sm text-center">
        <div className="text-4xl mb-4">&#128274;</div>
        <h1 className="font-heading text-2xl text-txt-primary mb-2">Access Denied</h1>
        <p className="text-sm text-txt-muted font-body mb-6">
          Your email is not on the admin whitelist.
        </p>
        <Link href="/" className="btn-primary px-6 py-2 inline-block">
          Back to Home
        </Link>
      </div>
    </div>
  )
}
