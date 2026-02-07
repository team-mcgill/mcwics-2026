import { useRef, useEffect, useState } from 'react'
import { useFaceMesh } from '../hooks/useFaceMesh'
import { DrawingCanvas } from './DrawingCanvas'
import { FaceMeshCanvas } from './FaceMeshCanvas'
import { BrushControls } from './BrushControls'

export function Camera() {
  const videoRef = useRef(null)
  const drawingCanvasRef = useRef(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [brushColor, setBrushColor] = useState('#ff0000')
  const [brushSize, setBrushSize] = useState(5)
  const [showFaceMesh, setShowFaceMesh] = useState(true)
  const { faceLandmarks, isLoaded, error, startDetection, stopDetection } = useFaceMesh(videoRef)

  useEffect(() => {
    let videoEl = null
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })

        if (videoRef.current) {
          videoEl = videoRef.current
          videoEl.srcObject = stream
          setIsStreaming(true)
        }
      } catch (err) {
        console.error('Error accessing camera:', err)
      }
    }

    startCamera()

    return () => {
      const stream = videoEl?.srcObject ?? null
      stream?.getTracks().forEach((track) => track.stop())
      stopDetection()
    }
  }, [stopDetection])

  useEffect(() => {
    if (isStreaming && isLoaded) {
      startDetection()
    }
  }, [isStreaming, isLoaded, startDetection])

  const handleVideoPlay = () => {
    if (isLoaded) {
      startDetection()
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-500">
        Error loading face mesh: {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onPlay={handleVideoPlay}
          className="rounded-lg shadow-lg"
          style={{ width: '640px', height: '480px', transform: 'scaleX(-1)' }}
        />

        <FaceMeshCanvas faceLandmarks={faceLandmarks} showFaceMesh={showFaceMesh} />

        <DrawingCanvas ref={drawingCanvasRef} brushColor={brushColor} brushSize={brushSize} />

        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <div className="text-white">Loading face mesh...</div>
          </div>
        )}
      </div>

      <BrushControls
        brushColor={brushColor}
        brushSize={brushSize}
        showFaceMesh={showFaceMesh}
        onColorChange={setBrushColor}
        onSizeChange={setBrushSize}
        onToggleFaceMesh={() => setShowFaceMesh(!showFaceMesh)}
        onClearCanvas={() => drawingCanvasRef.current?.clear()}
      />
    </div>
  )
}
