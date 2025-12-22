export interface User {
  id: string
  name: string
  email: string
  created_at: string
}

export interface Video {
  id: string
  user_id: string
  title: string
  description?: string
  filename: string
  filepath: string
  duration?: number
  thumbnail?: string
  status: "uploaded" | "processing" | "completed" | "failed"
  created_at: string
  updated_at: string
  // Related, denormalized by GET /api/videos/:id
  transcript?: Transcript | null
  voiceover?: Voiceover | null
  documentation?: Documentation | null
}

export interface Transcript {
  id: string
  video_id: string
  original_transcript?: string
  improved_script?: string
  language?: string
  created_at?: string
}

export interface ImprovedScript {
  id: string
  video_id: string
  content: string
  created_at: string
}

export interface Voiceover {
  id: string
  video_id: string
  voice_type: string
  filepath: string
  created_at?: string
}

export interface Documentation {
  id: string
  video_id: string
  content: string
  format?: string
  created_at?: string
}

export interface ShareToken {
  token: string
  video_id: string
  created_at: string
  expires_at?: string
}

export interface AuthResponse {
  message: string
  token: string
  user: User
}

export interface ApiError {
  message: string
  errors?: Record<string, string[]>
}
