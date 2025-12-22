"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import apiClient from "@/lib/axios"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploaded?: (videoId: string) => void
}

type CaptureMode = "screen" | "tab"

function pickSupportedMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ]
  return candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t))
}

export function RecordDialog({ open, onOpenChange, onUploaded }: Props) {
  const { toast } = useToast()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [includeMic, setIncludeMic] = useState(true)
  const [includeCamera, setIncludeCamera] = useState(false)
  const [cameraCorner, setCameraCorner] = useState<"br" | "bl" | "tr" | "tl">("br")
  const [cameraSize, setCameraSize] = useState<"sm" | "md" | "lg">("md")
  const focusMode = true

  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [pillPos, setPillPos] = useState<{ x: number; y: number } | null>(null)
  const [showPostStopPill, setShowPostStopPill] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; dragging: boolean } | null>(
    null,
  )

  const mimeType = useMemo(() => pickSupportedMimeType(), [])

  useEffect(() => {
    if (!open) return
    if (!isRecording && !isUploading) {
      setSeconds(0)
    }
  }, [open, isRecording, isUploading])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (isRecording) {
      setMinimized(true)
      onOpenChange(false)
      setPillPos(null)
    }
  }, [isRecording, onOpenChange])

  useEffect(() => {
    if (!isRecording && previewBlob) {
      // Some browsers won't reliably re-open the dialog after stopping via browser UI.
      // Keep a persistent pill so user can Save/Discard.
      setShowPostStopPill(true)
      setMinimized(true)

      // Best-effort: still try to reopen the dialog.
      onOpenChange(true)
    }
  }, [isRecording, previewBlob, onOpenChange])

  useEffect(() => {
    if (!open && !isRecording && !showPostStopPill) setMinimized(false)
  }, [open])

  const stopTracks = (s: MediaStream | null) => {
    if (!s) return
    for (const t of s.getTracks()) t.stop()
  }

  const stopRaf = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  const stopCameraStream = () => {
    if (!cameraStreamRef.current) return
    for (const t of cameraStreamRef.current.getTracks()) t.stop()
    cameraStreamRef.current = null
  }

  const startTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => setSeconds((v) => v + 1), 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
  }

  const startRecording = async () => {
    try {
      if (!mimeType) {
        toast({
          title: "Unsupported",
          description: "Your browser does not support WebM recording (MediaRecorder).",
          variant: "destructive"
        })
        return
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      } as any)

      let cameraStream: MediaStream | null = null
      if (includeCamera) {
        try {
          cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          cameraStreamRef.current = cameraStream
        } catch {
          cameraStream = null
        }
      }

      let micStream: MediaStream | null = null
      if (includeMic) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        } catch {
          micStream = null
        }
      }

      const outputVideoTracks: MediaStreamTrack[] = []

      let screenVideoTrack: MediaStreamTrack | undefined = displayStream.getVideoTracks()[0]

      if (includeCamera && cameraStream && screenVideoTrack) {
        const screenVideoEl = document.createElement("video")
        screenVideoEl.muted = true
        screenVideoEl.playsInline = true
        screenVideoEl.srcObject = new MediaStream([screenVideoTrack])
        await screenVideoEl.play()

        const camTrack = cameraStream.getVideoTracks()[0]
        const camVideoEl = document.createElement("video")
        camVideoEl.muted = true
        camVideoEl.playsInline = true
        camVideoEl.srcObject = camTrack ? new MediaStream([camTrack]) : null
        if (camTrack) await camVideoEl.play()

        const canvas = document.createElement("canvas")
        canvasRef.current = canvas

        const settings = screenVideoTrack.getSettings?.() as any
        const width = (settings?.width as number) || 1280
        const height = (settings?.height as number) || 720
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("Canvas not supported")

        const bubblePx = cameraSize === "sm" ? Math.round(width * 0.18) : cameraSize === "lg" ? Math.round(width * 0.28) : Math.round(width * 0.22)
        const pad = Math.max(12, Math.round(width * 0.015))
        const bubbleW = bubblePx
        const bubbleH = Math.round((bubblePx * 9) / 16)

        const calcBubbleXY = () => {
          const x = cameraCorner.endsWith("r") ? width - bubbleW - pad : pad
          const y = cameraCorner.startsWith("b") ? height - bubbleH - pad : pad
          return { x, y }
        }

        const draw = () => {
          const { x, y } = calcBubbleXY()

          ctx.clearRect(0, 0, width, height)
          ctx.drawImage(screenVideoEl, 0, 0, width, height)

          if (camTrack) {
            // rounded rect bubble
            const r = 14

            // Soft drop shadow behind the bubble
            ctx.save()
            ctx.shadowColor = "rgba(0,0,0,0.35)"
            ctx.shadowBlur = 18
            ctx.shadowOffsetX = 0
            ctx.shadowOffsetY = 10
            ctx.fillStyle = "rgba(0,0,0,0.10)"
            ctx.beginPath()
            ctx.moveTo(x + r, y)
            ctx.arcTo(x + bubbleW, y, x + bubbleW, y + bubbleH, r)
            ctx.arcTo(x + bubbleW, y + bubbleH, x, y + bubbleH, r)
            ctx.arcTo(x, y + bubbleH, x, y, r)
            ctx.arcTo(x, y, x + bubbleW, y, r)
            ctx.closePath()
            ctx.fill()
            ctx.restore()

            // Background blur behind the bubble (best-effort)
            ctx.save()
            ctx.beginPath()
            ctx.moveTo(x + r, y)
            ctx.arcTo(x + bubbleW, y, x + bubbleW, y + bubbleH, r)
            ctx.arcTo(x + bubbleW, y + bubbleH, x, y + bubbleH, r)
            ctx.arcTo(x, y + bubbleH, x, y, r)
            ctx.arcTo(x, y, x + bubbleW, y, r)
            ctx.closePath()
            ctx.clip()
            // Blur whatever is behind (screen) and add a translucent overlay
            // Note: CanvasRenderingContext2D.filter is supported in modern Chrome.
            ctx.filter = "blur(10px)"
            ctx.drawImage(screenVideoEl, x, y, bubbleW, bubbleH, x, y, bubbleW, bubbleH)
            ctx.filter = "none"
            ctx.fillStyle = "rgba(0,0,0,0.12)"
            ctx.fillRect(x, y, bubbleW, bubbleH)
            ctx.restore()

            // Draw the camera feed on top
            ctx.save()
            ctx.beginPath()
            ctx.moveTo(x + r, y)
            ctx.arcTo(x + bubbleW, y, x + bubbleW, y + bubbleH, r)
            ctx.arcTo(x + bubbleW, y + bubbleH, x, y + bubbleH, r)
            ctx.arcTo(x, y + bubbleH, x, y, r)
            ctx.arcTo(x, y, x + bubbleW, y, r)
            ctx.closePath()
            ctx.clip()

            ctx.drawImage(camVideoEl, x, y, bubbleW, bubbleH)
            ctx.restore()

            // subtle border
            ctx.strokeStyle = "rgba(255,255,255,0.75)"
            ctx.lineWidth = 2
            ctx.strokeRect(x, y, bubbleW, bubbleH)
          }

          rafRef.current = requestAnimationFrame(draw)
        }

        draw()

        const canvasStream = canvas.captureStream(30)
        const canvasVideoTrack = canvasStream.getVideoTracks()[0]
        if (canvasVideoTrack) outputVideoTracks.push(canvasVideoTrack)
      } else if (screenVideoTrack) {
        outputVideoTracks.push(screenVideoTrack)
      }

      const audioTracks = [
        ...displayStream.getAudioTracks(),
        ...(micStream ? micStream.getAudioTracks() : [])
      ]

      const mixedTracks: MediaStreamTrack[] = [...outputVideoTracks]

      if (audioTracks.length > 0) {
        const audioCtx = new AudioContext()
        const dest = audioCtx.createMediaStreamDestination()
        for (const at of audioTracks) {
          const src = audioCtx.createMediaStreamSource(new MediaStream([at]))
          src.connect(dest)
        }
        const mixedAudio = dest.stream.getAudioTracks()[0]
        if (mixedAudio) mixedTracks.push(mixedAudio)
      }

      const outStream = new MediaStream(mixedTracks)
      streamRef.current = outStream

      const recorder = new MediaRecorder(outStream, { mimeType })
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stopTimer()
        setIsRecording(false)

        stopRaf()
        stopTracks(displayStream)
        stopTracks(micStream)
        stopTracks(outStream)
        stopCameraStream()

        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: "video/webm" })
          setPreviewBlob(blob)
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return URL.createObjectURL(blob)
          })

          setMinimized(false)
          onOpenChange(true)
        }
      }

      displayStream.getTracks().forEach((t) =>
        t.addEventListener("ended", () => {
          if (recorderRef.current && recorderRef.current.state !== "inactive") {
            recorderRef.current.stop()
          }
        })
      )

      recorder.start(1000)
      setIsRecording(true)
      setSeconds(0)
      startTimer()
      setMinimized(true)
    } catch (err: any) {
      toast({
        title: "Recording failed",
        description: err?.message ?? "Could not start recording.",
        variant: "destructive"
      })

      stopRaf()
      stopCameraStream()
    }
  }

  const stopRecording = async () => {
    const r = recorderRef.current
    if (!r) return
    if (r.state !== "inactive") r.stop()
  }

  const stopFromPill = async () => {
    await stopRecording()
    setMinimized(false)
  }

  const discardRecording = () => {
    chunksRef.current = []
    setPreviewBlob(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setSeconds(0)
    setShowPostStopPill(false)
    setMinimized(false)
  }

  const downloadRecording = async () => {
    if (!previewBlob) return
    const url = URL.createObjectURL(previewBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = `recording-${Date.now()}.webm`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const uploadRecording = async () => {
    try {
      if (isRecording) {
        toast({
          title: "Stop recording first",
          description: "Please stop the recording before uploading.",
          variant: "destructive"
        })
        return
      }

      const blobToUpload = previewBlob ?? (chunksRef.current.length ? new Blob(chunksRef.current, { type: "video/webm" }) : null)

      if (!blobToUpload) {
        toast({
          title: "Nothing to upload",
          description: "Record something first.",
          variant: "destructive"
        })
        return
      }

      setIsUploading(true)

      const file = new File([blobToUpload], `recording-${Date.now()}.webm`, { type: "video/webm" })

      const formData = new FormData()
      formData.append("video", file)
      formData.append("title", title || "Screen recording")
      formData.append("description", description)

      const { data } = await apiClient.post("/api/videos", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })

      toast({ title: "Uploaded", description: "Recording uploaded successfully." })

      discardRecording()

      onOpenChange(false)
      onUploaded?.(data.id)
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err?.response?.data?.message || err?.message || "Failed to upload recording",
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
    }
  }

  const onPillPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement | null
    if (target && (target.tagName === "BUTTON" || target.closest("button"))) return

    const originX = pillPos?.x ?? 0
    const originY = pillPos?.y ?? 0

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX,
      originY,
      dragging: true,
    }

    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPillPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d?.dragging) return

    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY

    const maxX = Math.max(0, window.innerWidth - 180)
    const maxY = Math.max(0, window.innerHeight - 60)

    const nextX = Math.min(maxX, Math.max(0, d.originX + dx))
    const nextY = Math.min(maxY, Math.max(0, d.originY + dy))

    setPillPos({ x: nextX, y: nextY })
  }

  const onPillPointerUp = () => {
    if (dragRef.current) dragRef.current.dragging = false
  }

  const canRecord = typeof window !== "undefined" && !!navigator?.mediaDevices?.getDisplayMedia

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (isRecording) {
            onOpenChange(false)
            return
          }

          if (!isUploading) onOpenChange(v)
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>Record</DialogTitle>
                <DialogDescription>
                  {isRecording
                    ? "Recording in progress"
                    : "Record your screen (default) or a browser tab, then upload it to your library."}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {isRecording && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => {
                    setMinimized(true)
                    onOpenChange(false)
                  }}>
                    Minimize
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {!canRecord && (
            <div className="text-sm text-muted-foreground">Screen recording is not supported in this browser.</div>
          )}

          <div className="grid gap-4 overflow-y-auto pr-1" style={{ maxHeight: "calc(85vh - 10rem)" }}>
            <div className="grid gap-2">
              <Label htmlFor="record-title">Title</Label>
              <Input
                id="record-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. How to create a new project"
                disabled={isRecording || isUploading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="record-desc">Description (optional)</Label>
              <Input
                id="record-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="One-line summary"
                disabled={isRecording || isUploading}
              />
            </div>

            <div className="rounded-lg border p-3">
              <div className="text-sm font-medium">Recording tips</div>
              <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground space-y-1">
                <li>In the picker, choose <span className="font-medium">Entire screen</span> for full-screen recordings.</li>
                <li>Choose <span className="font-medium">Chrome Tab</span> for tutorial recordings.</li>
                <li>For tab recordings, enable <span className="font-medium">Share tab audio</span> if you want system/tab sound.</li>
              </ul>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Include microphone</div>
                <div className="text-xs text-muted-foreground">Mix your mic audio into the recording</div>
              </div>
              <Switch checked={includeMic} onCheckedChange={setIncludeMic} disabled={isRecording || isUploading} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Include camera bubble</div>
                <div className="text-xs text-muted-foreground">Add your webcam as a picture-in-picture overlay</div>
              </div>
              <Switch checked={includeCamera} onCheckedChange={setIncludeCamera} disabled={isRecording || isUploading} />
            </div>

            {includeCamera && (
              <div className="grid gap-3 rounded-lg border p-3">
                <div className="grid gap-2">
                  <Label htmlFor="camera-corner">Camera position</Label>
                  <select
                    id="camera-corner"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={cameraCorner}
                    onChange={(e) => setCameraCorner(e.target.value as any)}
                    disabled={isRecording || isUploading}
                  >
                    <option value="tr">Top right</option>
                    <option value="tl">Top left</option>
                    <option value="br">Bottom right</option>
                    <option value="bl">Bottom left</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="camera-size">Camera size</Label>
                  <select
                    id="camera-size"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={cameraSize}
                    onChange={(e) => setCameraSize(e.target.value as any)}
                    disabled={isRecording || isUploading}
                  >
                    <option value="sm">Small</option>
                    <option value="md">Medium</option>
                    <option value="lg">Large</option>
                  </select>
                </div>

                <div className="text-xs text-muted-foreground">
                  Note: camera bubble is composited locally and recorded into the final video.
                </div>
              </div>
            )}

            <div className="text-sm">
              Status: <span className="font-medium">{isRecording ? `Recording (${seconds}s)` : "Idle"}</span>
            </div>

            {previewUrl && !isRecording && (
              <div className="grid gap-2">
                <Label>Preview</Label>
                <video src={previewUrl} controls playsInline className="w-full rounded-lg border" />
                <p className="text-xs text-muted-foreground">
                  Review your recording before uploading.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={downloadRecording} disabled={isUploading}>
                    Download
                  </Button>
                  <Button type="button" variant="outline" onClick={discardRecording} disabled={isUploading}>
                    Discard
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {!isRecording ? (
              <Button onClick={startRecording} disabled={!canRecord || isUploading}>
                Start recording
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="destructive" disabled={isUploading}>
                Stop recording
              </Button>
            )}

            <Button
              onClick={uploadRecording}
              variant="secondary"
              disabled={isUploading || isRecording || (!previewBlob && chunksRef.current.length === 0)}
            >
              {isUploading ? "Uploading…" : "Upload to library"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Minimized recording pill */}
      {minimized && (isRecording || (showPostStopPill && !!previewBlob)) && (
        <div
          className="fixed z-50 left-4 bottom-4"
          style={pillPos ? { transform: `translate(${pillPos.x}px, ${pillPos.y}px)` } : undefined}
          onPointerDown={onPillPointerDown}
          onPointerMove={onPillPointerMove}
          onPointerUp={onPillPointerUp}
        >
          <div className="flex items-center gap-2 rounded-full border bg-background/95 backdrop-blur px-3 py-2 shadow-lg">
            <div className={`h-2 w-2 rounded-full ${isRecording ? "bg-red-500" : "bg-emerald-500"}`} />
            <div className="text-sm font-medium">{isRecording ? "Recording" : "Recorded"}</div>
            <div className="text-xs text-muted-foreground tabular-nums">{seconds}s</div>
            <div className="w-px h-5 bg-border mx-1" />
            {isRecording ? (
              <Button size="sm" variant="destructive" onClick={stopFromPill}>
                Stop
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={uploadRecording} disabled={isUploading}>
                {isUploading ? "Saving…" : "Save"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={discardRecording} disabled={isUploading}>
              Discard
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMinimized(false)
                onOpenChange(true)
              }}
            >
              {isRecording ? "Open" : "Preview"}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
