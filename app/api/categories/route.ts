import { NextResponse } from 'next/server'
import { getCategories } from '@/lib/data'

export async function GET() {
  return NextResponse.json(getCategories())
}
