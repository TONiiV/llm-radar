import { NextResponse } from 'next/server'
import { fetchModelWithScores, fetchCategories } from '@/lib/data'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? []

  const allModels = await fetchModelWithScores()
  const selected = ids.length > 0
    ? allModels.filter(m => ids.includes(m.slug))
    : allModels
  const categories = await fetchCategories()

  return NextResponse.json({ models: selected, categories })
}
