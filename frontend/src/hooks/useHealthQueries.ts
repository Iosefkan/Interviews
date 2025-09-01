import { useQuery } from '@tanstack/react-query'
import { HealthService } from '../services/hrService'
import { queryKeys } from '../lib/queryClient'

export const useHealthQueries = () => {
  // Basic health check
  const useHealthCheck = () => {
    return useQuery<any, Error>({
      queryKey: queryKeys.health(),
      queryFn: HealthService.checkHealth,
      staleTime: 30 * 1000, // 30 seconds
      refetchInterval: 60 * 1000, // Refetch every minute
    })
  }

  // Detailed health check
  const useDetailedHealth = () => {
    return useQuery<any, Error>({
      queryKey: queryKeys.detailedHealth(),
      queryFn: HealthService.getDetailedHealth,
      staleTime: 30 * 1000, // 30 seconds
      refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
    })
  }

  return {
    useHealthCheck,
    useDetailedHealth
  }
}