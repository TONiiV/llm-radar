"use client"

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts"
import type { ModelWithScores } from "@/lib/types"
import { getModelColor } from "@/lib/colors"
import { avgPricePer1M, formatPrice } from "@/lib/pricing"
import { useLocale } from "@/lib/i18n-context"

interface PriceScatterProps {
  models: ModelWithScores[]
  selectedSlugs: string[]
  paretoSlugs: string[]
}

export default function PriceScatter({
  models,
  selectedSlugs,
  paretoSlugs,
}: PriceScatterProps) {
  const { t } = useLocale()
  const selected = models.filter((m) => selectedSlugs.includes(m.slug))

  const data = selected.map((m, i) => ({
    name: m.name,
    slug: m.slug,
    x: avgPricePer1M(m.pricing.input_per_1m, m.pricing.output_per_1m),
    y: Math.round(m.compositeScore),
    isPareto: paretoSlugs.includes(m.slug),
    isReasoning: m.is_reasoning_model,
    confirmed: m.pricing.confirmed,
    color: getModelColor(i),
    inputPrice: m.pricing.input_per_1m,
    outputPrice: m.pricing.output_per_1m,
  }))

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div
        className="paper-card-flat p-3 text-sm"
        style={{
          borderRadius: "0",
        }}
      >
        <p className="font-heading font-semibold text-txt-primary">{d.name}</p>
        <p className="font-mono text-txt-secondary">
          {t("chart.overallAbility")}: {d.y}/100
        </p>
        <p className="font-mono text-txt-secondary">
          {t("chart.input")}: {d.confirmed ? "" : "~"}{formatPrice(d.inputPrice)}/1M
        </p>
        <p className="font-mono text-txt-secondary">
          {t("chart.output")}: {d.confirmed ? "" : "~"}{formatPrice(d.outputPrice)}/1M
        </p>
        <p className="font-mono text-txt-secondary">
          {t("chart.avgPrice")}: {formatPrice(d.x)}/1M
        </p>
        {d.isPareto && (
          <p className="font-mono font-medium mt-1 text-score-high">{t("chart.paretoFrontier")}</p>
        )}
        {d.isReasoning && (
          <p className="font-mono font-medium text-accent-orange">{t("chart.reasoningModel")}</p>
        )}
      </div>
    )
  }

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props
    const size = payload.isPareto ? 8 : 6

    if (payload.isReasoning) {
      const h = size * 1.5
      const points = `${cx},${cy - h} ${cx - h},${cy + h * 0.6} ${cx + h},${cy + h * 0.6}`
      return (
        <polygon
          points={points}
          fill={payload.color}
          stroke={payload.isPareto ? "#34d399" : "var(--color-border)"}
          strokeWidth={payload.isPareto ? 2 : 1}
        />
      )
    }

    return (
      <circle
        cx={cx}
        cy={cy}
        r={size}
        fill={payload.color}
        stroke={payload.isPareto ? "#34d399" : "var(--color-border)"}
        strokeWidth={payload.isPareto ? 2 : 1}
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={380}>
      <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="x"
          type="number"
          scale="log"
          domain={["dataMin", "dataMax"]}
          name={t("chart.avgPrice")}
          unit="$/1M"
          tick={{ fontSize: 11, fill: "var(--color-txt-muted)" }}
          label={{
            value: t("chart.avgPriceAxis"),
            position: "bottom",
            offset: 0,
            style: { fontSize: 12, fill: "var(--color-txt-muted)" },
          }}
          tickFormatter={(v: number) => `$${v}`}
          stroke="var(--color-border)"
        />
        <YAxis
          dataKey="y"
          type="number"
          name={t("chart.overallAbility")}
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "var(--color-txt-muted)" }}
          label={{
            value: t("chart.compositeAxis"),
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 12, fill: "var(--color-txt-muted)" },
          }}
          stroke="var(--color-border)"
        />
        <Tooltip content={<CustomTooltip />} />
        <Scatter data={data} shape={<CustomDot />}>
          {data.map((d) => (
            <Cell key={d.slug} fill={d.color} />
          ))}
        </Scatter>
        {data.map((d) => (
          <ReferenceLine
            key={`label-${d.slug}`}
            x={undefined}
            y={undefined}
            label=""
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}
