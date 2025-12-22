"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useVideo } from "@/hooks/use-video"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/status-badge"
import { ActionButtons } from "@/components/action-buttons"
import { MarkdownViewer } from "@/components/markdown-viewer"
import { useToast } from "@/hooks/use-toast"
import apiClient from "@/lib/axios"
import { ArrowLeft, Share2, Trash2, Copy, ExternalLink } from "lucide-react"
import useSWR from "swr"

const fetcher = (url: string) => apiClient.get(url).then((res) => res.data)

export default function VideoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const { video, isLoading, mutate } = useVideo(id)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this video?")) return

    setIsDeleting(true)
    try {
      await apiClient.delete(`/api/videos/${id}`)
      toast({
        title: "Success",
        description: "Video deleted successfully",
      })
      router.push("/videos")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete video",
        variant: "destructive",
      })
      setIsDeleting(false)
    }
  }

  const handleShare = async () => {
    setIsSharing(true)
    try {
      const { data } = await apiClient.post(`/api/videos/${id}/share`)
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/share/${data.token}`
      setShareUrl(url)
      toast({
        title: "Success",
        description: "Share link generated",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to generate share link",
        variant: "destructive",
      })
    } finally {
      setIsSharing(false)
    }
  }

  const copyShareUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      toast({
        title: "Copied",
        description: "Share URL copied to clipboard",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!video) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Video not found</h2>
        <Link href="/videos">
          <Button>Back to Library</Button>
        </Link>
      </div>
    )
  }

  const videoUrl = `${process.env.NEXT_PUBLIC_API_URL}${video.filepath}`

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/videos">
          <Button variant="ghost" className="gap-2 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Library
          </Button>
        </Link>
      </div>

      {/* Video Player */}
      <Card className="mb-6">
        <CardContent className="p-0">
          <div className="aspect-video bg-black rounded-t-lg overflow-hidden">
            <video src={videoUrl} controls className="w-full h-full">
              Your browser does not support the video tag.
            </video>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
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
              <div className="flex gap-2">
                <Button onClick={handleShare} disabled={isSharing} variant="outline" className="gap-2 bg-transparent">
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
                <Button onClick={handleDelete} disabled={isDeleting} variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>

            {/* Share URL */}
            {shareUrl && (
              <Card className="bg-muted">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">Share URL</p>
                      <p className="text-sm font-mono truncate">{shareUrl}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={copyShareUrl}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>AI Processing</CardTitle>
          <CardDescription>Apply AI enhancements to your video</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionButtons videoId={video.id} hasTranscript={!!video.transcript?.original_transcript} onSuccess={mutate} />
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
              {video.transcript?.original_transcript ? (
                <div className="space-y-3">
                  {/* Heuristic: visual transcript generated from silent video */}
                  {/^\s*\d+\./m.test(video.transcript.original_transcript) && (
                    <div className="rounded-lg border border-border/60 bg-muted/50 p-3 text-sm text-muted-foreground">
                      This appears to be a non-voice video. No audio transcription is available. Showing a visual summary generated from the video instead.
                    </div>
                  )}
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg text-sm leading-relaxed">
                      {video.transcript.original_transcript}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No transcript available. Click "Transcribe" to generate one (audio transcript or visual summary for silent videos).</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="script" className="mt-6">
              {video.transcript?.improved_script ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg text-sm leading-relaxed">
                    {video.transcript.improved_script}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No improved script available. Click "Improve Script" to generate one.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="voiceover" className="mt-6">
              {video.voiceover?.filepath ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Voice Type: {video.voiceover.voice_type}</p>
                    <audio src={`${process.env.NEXT_PUBLIC_API_URL}${video.voiceover.filepath}`} controls className="w-full">
                      Your browser does not support the audio tag.
                    </audio>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No voiceover available. Click "Generate Voiceover" to create one.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="docs" className="mt-6">
              {video.documentation?.content ? (
                <MarkdownViewer content={video.documentation.content} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No documentation available. Click "Generate Docs" to create documentation.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
