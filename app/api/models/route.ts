import { NextResponse } from 'next/server'
import { fetchModelWithScores } from '@/lib/data'

export async function GET() {
  const models = await fetchModelWithScores()
  return NextResponse.json(models)
}
