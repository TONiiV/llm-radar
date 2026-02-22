export function estimateTypicalQueryCost(
  inputPricePer1M: number,
  outputPricePer1M: number,
  isReasoningModel: boolean
): number {
  const inputTokens = 1000
  const outputTokens = isReasoningModel ? 5000 : 500
  return (
    (inputTokens * inputPricePer1M + outputTokens * outputPricePer1M) /
    1_000_000
  )
}

export function formatPrice(price: number): string {
  if (price < 0.001) return `$${price.toFixed(5)}`
  if (price < 0.01) return `$${price.toFixed(4)}`
  if (price < 1) return `$${price.toFixed(3)}`
  return `$${price.toFixed(2)}`
}

export function avgPricePer1M(inputPer1M: number, outputPer1M: number): number {
  return (inputPer1M + outputPer1M) / 2
}
