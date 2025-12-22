"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/status-badge"
import { MarkdownViewer } from "@/components/markdown-viewer"
import { Play, AlertCircle } from "lucide-react"
import axios from "axios"
import type { Video } from "@/types"

interface SharedVideoData {
  video: Video
}

export default function SharedVideoPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<SharedVideoData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSharedVideo = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/share/${params.token}`)
        setData(response.data)
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load shared video")
      } finally {
        setIsLoading(false)
      }
    }

    fetchSharedVideo()
  }, [params.token])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Video Not Available</h2>
            <p className="text-muted-foreground">{error || "This shared video could not be found."}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { video } = data
  const transcript = video.transcript
  const voiceover = video.voiceover
  const documentation = video.documentation
  const videoUrl = `${process.env.NEXT_PUBLIC_API_URL}${video.filepath}`

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-2 rounded-lg">
              <Play className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">VideoAI</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Video Player */}
        <Card className="mb-6">
          <CardContent className="p-0">
            <div className="aspect-video bg-black rounded-t-lg overflow-hidden">
              <video src={videoUrl} controls className="w-full h-full">
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">{video.title}</h1>
                <StatusBadge status={video.status} />
              </div>
              {video.description && <p className="text-muted-foreground">{video.description}</p>}
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                {video.duration && <span>Duration: {Math.round(video.duration)}s</span>}
                <span>Uploaded: {new Date(video.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Tabs */}
        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="transcript">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="script">Improved Script</TabsTrigger>
                <TabsTrigger value="voiceover">Voiceover</TabsTrigger>
                <TabsTrigger value="docs">Documentation</TabsTrigger>
              </TabsList>

              <TabsContent value="transcript" className="mt-6">
                {transcript?.original_transcript ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg text-sm leading-relaxed">
                      {transcript.original_transcript}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No transcript available for this video.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="script" className="mt-6">
                {transcript?.improved_script ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg text-sm leading-relaxed">
                      {transcript.improved_script}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No improved script available for this video.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="voiceover" className="mt-6">
                {voiceover?.filepath ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Voice Type: {voiceover.voice_type}</p>
                      <audio
                        src={`${process.env.NEXT_PUBLIC_API_URL}${voiceover.filepath}`}
                        controls
                        className="w-full"
                      >
                        Your browser does not support the audio tag.
                      </audio>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No voiceover available for this video.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="docs" className="mt-6">
                {documentation?.content ? (
                  <MarkdownViewer content={documentation.content} />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No documentation available for this video.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Shared via VideoAI - AI-powered video platform</p>
        </div>
      </div>
    </div>
  )
}
