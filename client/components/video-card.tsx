import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import type { Video } from "@/types"
import { Play } from "lucide-react"

interface VideoCardProps {
  video: Video
}

export function VideoCard({ video }: VideoCardProps) {
  const thumbnailUrl = video.thumbnail ? `${process.env.NEXT_PUBLIC_API_URL}${video.thumbnail}` : "/video-thumbnail.png"

  return (
    <Link href={`/videos/${video.id}`}>
      <Card className="overflow-hidden hover-lift hover:glow-effect transition-all duration-300 border-border/50 backdrop-blur-sm bg-card/80">
        <div className="relative aspect-video bg-linear-to-br from-muted to-muted/50">
          <Image src={thumbnailUrl || "/placeholder.svg"} alt={video.title} fill className="object-cover" />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent opacity-0 hover:opacity-100 transition-all duration-300 flex items-center justify-center group">
            <div className="bg-primary text-primary-foreground p-4 rounded-full transform scale-90 group-hover:scale-100 transition-transform duration-300 pulse-glow">
              <Play className="h-7 w-7" fill="currentColor" />
            </div>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-base line-clamp-1">{video.title}</h3>
            <StatusBadge status={video.status} />
          </div>
          {video.description && <p className="text-sm text-muted-foreground line-clamp-2">{video.description}</p>}
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            {video.duration && <span>{Math.round(video.duration)}s</span>}
            <span>{new Date(video.created_at).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
