"use client"

import useSWR from "swr"
import apiClient from "@/lib/axios"
import type { Video } from "@/types"

const fetcher = (url: string) => apiClient.get(url).then((res) => res.data)

export function useVideo(id: string | number) {
  const { data, error, mutate } = useSWR<Video>(id ? `/api/videos/${id}` : null, fetcher)

  return {
    video: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  }
}
