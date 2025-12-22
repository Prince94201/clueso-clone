"use client"

import { useAuth } from "@/hooks/use-auth"
import { useVideos } from "@/hooks/use-videos"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VideoCard } from "@/components/video-card"
import { Video, Clock, CheckCircle2, AlertCircle } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CircleDot } from "lucide-react"

export default function DashboardPage() {
  const { user } = useAuth()
  const { videos, isLoading } = useVideos(undefined, 1, 5)
  const router = useRouter()
  const [_unused, _setUnused] = useState(false)

  const stats = videos.reduce(
    (acc, video) => {
      acc.total++
      if (video.status === "processing") acc.processing++
      if (video.status === "completed") acc.completed++
      if (video.status === "failed") acc.failed++
      return acc
    },
    { total: 0, processing: 0, completed: 0, failed: 0 },
  )

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title={`Welcome back, ${user?.name || "User"}`}
          description="Here's an overview of your video library"
        />
        <div className="pt-1">
          <Button onClick={() => router.push("/dashboard?record=1")} className="gap-2">
            <CircleDot className="h-4 w-4" />
            Record
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="fade-in hover-lift border-border/50 overflow-hidden relative group">
          <div className="absolute inset-0 bg-linear-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Videos</CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Video className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold bg-linear-to-r from-primary to-accent bg-clip-text text-transparent">
              {stats.total}
            </div>
          </CardContent>
        </Card>

        <Card
          className="fade-in hover-lift border-border/50 overflow-hidden relative group"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="absolute inset-0 bg-linear-to-br from-warning/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
            <div className="p-2 bg-warning/10 rounded-lg">
              <Clock className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-warning">{stats.processing}</div>
          </CardContent>
        </Card>

        <Card
          className="fade-in hover-lift border-border/50 overflow-hidden relative group"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="absolute inset-0 bg-linear-to-br from-success/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <div className="p-2 bg-success/10 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-success">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card
          className="fade-in hover-lift border-border/50 overflow-hidden relative group"
          style={{ animationDelay: "0.3s" }}
        >
          <div className="absolute inset-0 bg-linear-to-br from-destructive/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
            <div className="p-2 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-destructive">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Videos */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading videos...</div>
        ) : videos.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No videos yet</h3>
              <p className="text-muted-foreground">Upload your first video to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {videos.slice(0, 3).map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
