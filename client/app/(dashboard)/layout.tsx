"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { NavBar } from "@/components/nav-bar"
import { Sidebar } from "@/components/sidebar"
import { RecordDialog } from "@/components/record-dialog"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, token, fetchUser } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [recordOpen, setRecordOpen] = useState(false)

  useEffect(() => {
    const initAuth = async () => {
      if (!token) {
        router.push("/login")
        return
      }

      if (!user) {
        try {
          await fetchUser()
        } catch (error) {
          router.push("/login")
        }
      }
      setIsLoading(false)
    }

    initAuth()
  }, [token, user, fetchUser, router])

  useEffect(() => {
    if (!searchParams) return
    const shouldOpen = searchParams.get("record") === "1"
    if (shouldOpen) setRecordOpen(true)
  }, [searchParams])

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/30 border-t-primary" />
          <p className="text-muted-foreground animate-pulse">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg">
      <NavBar onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <RecordDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        onUploaded={(id) => router.push(`/videos/${id}`)}
      />

      <main className="md:pl-64 pt-16">
        <div className="container mx-auto p-6 max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
