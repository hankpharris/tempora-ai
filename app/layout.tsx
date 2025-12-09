import "styles/tailwind.css"
import { ChatbotDock } from "@/components/chatbot/ChatbotDock"
import { GlobalNavbar } from "@/components/GlobalNavbar"
import { Providers } from "./providers"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased transition-colors">
        <Providers>
          <div className="flex min-h-screen flex-col bg-background">
            <GlobalNavbar />
            <main className="flex-1">{children}</main>
          </div>
          <ChatbotDock />
        </Providers>
      </body>
    </html>
  )
}
