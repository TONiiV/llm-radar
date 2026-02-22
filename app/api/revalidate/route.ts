import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { secret } = await request.json()
  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  revalidatePath('/compare', 'page')
  revalidatePath('/models', 'page')
  revalidatePath('/models/[slug]', 'page')

  return NextResponse.json({ revalidated: true, timestamp: Date.now() })
}
