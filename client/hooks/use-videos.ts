"use client"

import useSWR from "swr"
import apiClient from "@/lib/axios"
import type { Video } from "@/types"

const fetcher = (url: string) => apiClient.get(url).then((res) => res.data)

export function useVideos(status?: string, page = 1, limit = 10) {
  const params = new URLSearchParams()
  if (status) params.append("status", status)
  params.append("page", page.toString())
  params.append("limit", limit.toString())

  const { data, error, mutate } = useSWR<{
    videos: Video[]
    total: number
    page: number
    totalPages: number
  }>(`/api/videos?${params.toString()}`, fetcher)

  return {
    videos: data?.videos || [],
    total: data?.total || 0,
    page: data?.page || 1,
    totalPages: data?.totalPages || 1,
    isLoading: !error && !data,
    isError: error,
    mutate,
  }
}
