import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes (was cacheTime in v4)
      retry: 3,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
})

// Query key factory
export const queryKeys = {
  // CV related queries
  candidates: (filters?: any) => ['candidates', filters],
  candidate: (id: string) => ['candidate', id],
  cvAnalysis: (candidateId: string) => ['cv-analysis', candidateId],
  cvReport: (candidateId: string) => ['cv-report', candidateId],
  
  // Interview related queries
  interviews: (filters?: any) => ['interviews', filters],
  interview: (sessionId: string) => ['interview', sessionId],
  interviewReport: (sessionId: string) => ['interview-report', sessionId],
  
  // Health checks
  health: () => ['health'],
  detailedHealth: () => ['health', 'detailed'],
} as const