"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ExtensionInstallPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "sent" | "synced">("idle")

  const requestConnect = () => {
    window.postMessage({ type: "CLUESO_CLONE_REQUEST_TOKEN" }, "*")
    setStatus("sent")

    // Fallback: user is already signed in on the web app, so proceed even if extension doesn't ack.
    window.setTimeout(() => {
      router.push("/dashboard")
    }, 1200)
  }

  useEffect(() => {
    // Ask the extension (via content script) to sync token immediately
    requestConnect()
  }, [])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      if ((event.data as any)?.type === "CLUESO_CLONE_TOKEN_SYNCED") {
        setStatus("synced")
        // After connecting, take user to dashboard
        router.push("/dashboard")
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Install & connect the Chrome extension"
        description="Chrome doesn’t allow websites to auto-install extensions. Install once, then you can record anytime with one click."
      />

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>1) Install</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              In development: open <span className="font-medium">chrome://extensions</span> → enable Developer mode →
              <span className="font-medium"> Load unpacked</span> → select <span className="font-medium">clueso-clone/extension/dist</span>.
            </div>
            <div className="text-xs">
              Later, publish to the Chrome Web Store and replace this with an install link.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2) Connect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              After installing, refresh this page or open the extension popup. The extension will pick up your logged-in session.
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  requestConnect()
                }}
              >
                Connect now
              </Button>
              <Link href="/dashboard">
                <Button variant="secondary">Go to dashboard</Button>
              </Link>
            </div>
            <div className="text-xs">
              {status === "sent" ? "Connection request sent to extension." : ""}
              {status === "synced" ? "Token synced to extension." : ""}
            </div>
          </CardContent>
        </Card>

        <div className="text-sm text-muted-foreground">
          Tip: once connected, you can record any time by clicking the extension icon.
        </div>
      </div>
    </div>
  )
}
