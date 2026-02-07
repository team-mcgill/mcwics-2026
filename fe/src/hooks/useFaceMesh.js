import { useEffect, useRef, useState, useCallback } from 'react'
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision'

export function useFaceMesh(videoRef) {
  const faceLandmarkerRef = useRef(null)
  const [result, setResult] = useState({
    faceLandmarks: null,
    isLoaded: false,
    error: null,
  })
  const animationFrameRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)

  useEffect(() => {
    const initializeFaceMesh = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
        )

        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
        })

        faceLandmarkerRef.current = faceLandmarker
        setResult((prev) => ({ ...prev, isLoaded: true }))
      } catch (err) {
        setResult((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to load face mesh',
        }))
      }
    }

    initializeFaceMesh()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const detectFaces = useCallback(() => {
    const video = videoRef.current
    const faceLandmarker = faceLandmarkerRef.current

    if (!video || !faceLandmarker || video.paused || video.ended) {
      animationFrameRef.current = requestAnimationFrame(detectFaces)
      return
    }

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime
      const detections = faceLandmarker.detectForVideo(video, performance.now())

      setResult((prev) => ({
        ...prev,
        faceLandmarks: detections.faceLandmarks.length > 0 ? detections.faceLandmarks : null,
      }))
    }

    animationFrameRef.current = requestAnimationFrame(detectFaces)
  }, [videoRef])

  const startDetection = useCallback(() => {
    if (result.isLoaded) {
      animationFrameRef.current = requestAnimationFrame(detectFaces)
    }
  }, [result.isLoaded, detectFaces])

  const stopDetection = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  return {
    ...result,
    startDetection,
    stopDetection,
  }
}
