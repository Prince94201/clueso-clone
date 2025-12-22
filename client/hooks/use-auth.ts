"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import apiClient from "@/lib/axios"
import type { User, AuthResponse } from "@/types"

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  fetchUser: () => Promise<void>
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      setUser: (user) => set({ user }),
      setToken: (token) => {
        if (token) {
          localStorage.setItem("token", token)
        } else {
          localStorage.removeItem("token")
        }
        set({ token })
      },
      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const { data } = await apiClient.post<AuthResponse>("/api/auth/login", {
            email,
            password,
          })
          get().setToken(data.token)
          set({ user: data.user, isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      register: async (name: string, email: string, password: string) => {
        set({ isLoading: true })
        try {
          const { data } = await apiClient.post<AuthResponse>("/api/auth/register", {
            name,
            email,
            password,
          })
          get().setToken(data.token)
          set({ user: data.user, isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      logout: () => {
        get().setToken(null)
        set({ user: null })
      },
      fetchUser: async () => {
        const token = get().token
        if (!token) return

        set({ isLoading: true })
        try {
          const { data } = await apiClient.get<User>("/api/auth/me")
          set({ user: data, isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          get().logout()
          throw error
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ token: state.token }),
    },
  ),
)
