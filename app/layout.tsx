import type { Metadata } from "next"
import { EB_Garamond, DM_Sans, VT323 } from "next/font/google"
import { LocaleProvider } from "@/lib/i18n-context"
import { ThemeProvider } from "@/components/ThemeProvider"
import "./globals.css"

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-eb-garamond",
  display: "swap",
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
})

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "LLMRadar — LLM 能力雷达",
    template: "%s | LLMRadar",
  },
  description: "LLM 模型能力对比与价格分析工具：六维雷达图 + 价格性价比散点图",
  metadataBase: new URL("https://llmradar.dev"),
  openGraph: {
    type: "website",
    siteName: "LLMRadar",
    title: "LLMRadar — LLM Capability Radar",
    description: "LLM model comparison & pricing analysis: 6-axis radar chart + price-performance scatter plot",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="zh-CN"
      className={`${ebGaramond.variable} ${dmSans.variable} ${vt323.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <LocaleProvider>{children}</LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
