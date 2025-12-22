"use client"

import { useState } from "react"
import Link from "next/link"
import { useVideos } from "@/hooks/use-videos"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { VideoCard } from "@/components/video-card"
import { Pagination } from "@/components/pagination"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Video } from "lucide-react"
import type { Video as VideoType } from "@/types"

export default function VideosPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<VideoType["status"] | "all">("all")
  const { videos, totalPages, isLoading } = useVideos(statusFilter === "all" ? undefined : statusFilter, currentPage)

  return (
    <div>
      <PageHeader
        title="Video Library"
        description="Manage and organize your video content"
        action={
          <Link href="/videos/upload">
            <Button className="gap-2 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300">
              <Plus className="h-4 w-4" />
              Upload Video
            </Button>
          </Link>
        }
      />

      <div className="mb-6">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <TabsList className="glass-effect border border-border/50">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground"
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value="uploaded"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground"
            >
              Uploaded
            </TabsTrigger>
            <TabsTrigger
              value="processing"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground"
            >
              Processing
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground"
            >
              Completed
            </TabsTrigger>
            <TabsTrigger
              value="failed"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground"
            >
              Failed
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Videos Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading videos...</div>
      ) : videos.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No videos found</h3>
            <p className="text-muted-foreground mb-4">
              {statusFilter === "all" ? "Upload your first video to get started" : `No ${statusFilter} videos`}
            </p>
            <Link href="/videos/upload">
              <Button>Upload Video</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}
    </div>
  )
}
