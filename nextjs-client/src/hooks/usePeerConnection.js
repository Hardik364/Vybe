import { useEffect } from 'react'
import setPcInstance from '@/utils/pcInstance'

export default function usePeerConnection(setPeerConnection) {
  useEffect(() => {
    setPeerConnection(setPcInstance())
  }, [])
}
