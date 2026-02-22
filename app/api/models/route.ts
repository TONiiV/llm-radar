import { NextResponse } from 'next/server'
import { getModelWithScores } from '@/lib/data'

export async function GET() {
  const models = getModelWithScores()
  return NextResponse.json(models)
}
